import type * as Y from 'yjs';
import {
  ACTIVITY_COALESCE_MS,
  ACTIVITY_LOG_LIMIT,
  ActivityEntrySchema,
  type ActivityActor,
  type ActivityEntry,
  type Command,
} from '@forkcast/shared';
import { applyCommand, applyCommands, parseCommand, type BatchResult, type CommandResult } from './commands';
import { describeCommand } from './describe';
import { DocError } from './errors';
import { newId } from './ids';
import { getActivity, type Origin } from './schema';

/** Who performs a change. */
export interface Actor {
  actor: ActivityActor;
  actorId?: string;
  actorLabel?: string;
  color?: string;
  /** MCP tool name, for assistant changes. */
  tool?: string;
}

export interface RecordActivityInput extends Actor {
  summary: string;
  nodeIds: string[];
  command?: string;
  /** Inverse commands (kept so that the entry can be reverted from any client). */
  inverse?: Command[];
  /** Merge with the previous entry when it is the same edit by the same author (default true for people). */
  coalesce?: boolean;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((id) => set.has(id));
}

/**
 * Append an entry to the shared activity log (pruned to ACTIVITY_LOG_LIMIT). Repeated edits
 * of the same thing by the same person within ACTIVITY_COALESCE_MS replace the previous
 * entry instead of piling up.
 */
export function recordActivity(doc: Y.Doc, input: RecordActivityInput, origin: Origin = 'system'): ActivityEntry {
  const { coalesce: coalesceOpt, ...fields } = input;
  const entry: ActivityEntry = { id: newId(), at: Date.now(), ...fields };
  for (const key of Object.keys(entry) as Array<keyof ActivityEntry>) {
    if (entry[key] === undefined) delete entry[key];
  }
  if (entry.inverse && entry.inverse.length === 0) delete entry.inverse;
  const activity = getActivity(doc);
  const coalesce = coalesceOpt ?? input.actor !== 'ai';
  doc.transact(() => {
    const last = coalesce && activity.length > 0 ? activity.get(activity.length - 1) : undefined;
    if (
      last &&
      !last.reverted &&
      last.actor === entry.actor &&
      last.actorId === entry.actorId &&
      last.command !== undefined &&
      last.command === entry.command &&
      entry.at - last.at < ACTIVITY_COALESCE_MS &&
      sameIds(last.nodeIds, entry.nodeIds)
    ) {
      const merged: ActivityEntry = { ...entry, id: last.id };
      // keep the oldest inverse: reverting the merged entry restores the state before the first edit
      if (last.inverse && entry.inverse) merged.inverse = last.inverse;
      activity.delete(activity.length - 1, 1);
      activity.push([merged]);
      entry.id = last.id;
      return;
    }
    activity.push([entry]);
    if (activity.length > ACTIVITY_LOG_LIMIT) activity.delete(0, activity.length - ACTIVITY_LOG_LIMIT);
  }, origin);
  return entry;
}

export interface ExecuteOptions {
  origin?: Origin;
  /** Author recorded in the activity log; nothing is recorded when omitted. */
  actor?: Actor;
  /** Overrides the generated summary. */
  summary?: string;
  /** Keep the inverse commands in the log entry (default: only for assistant changes). */
  keepInverse?: boolean;
}

export interface ExecuteResult<T = unknown> extends CommandResult<T> {
  entry: ActivityEntry | null;
}

/**
 * Apply ONE command and record it in the activity log, in a single transaction. This is
 * the entry point used by the UI for every write.
 */
export function executeCommand<T = unknown>(doc: Y.Doc, input: Command | unknown, options: ExecuteOptions = {}): ExecuteResult<T> {
  const origin = options.origin ?? 'local';
  const command = parseCommand(input);
  let result!: CommandResult;
  let entry: ActivityEntry | null = null;
  doc.transact(() => {
    const summary = options.summary ?? describeCommand(doc, command);
    result = applyCommand(doc, command, origin);
    if (options.actor) {
      const keepInverse = options.keepInverse ?? options.actor.actor === 'ai';
      entry = recordActivity(
        doc,
        { ...options.actor, summary, command: command.type, nodeIds: result.affectedNodeIds, inverse: keepInverse ? result.inverse : undefined },
        origin,
      );
    }
  }, origin);
  return { ...(result as CommandResult<T>), entry };
}

export interface ExecuteBatchResult extends BatchResult {
  entry: ActivityEntry | null;
}

/** Apply several commands atomically and record them as ONE activity entry. */
export function executeCommands(doc: Y.Doc, inputs: Array<Command | unknown>, options: ExecuteOptions & { summary: string }): ExecuteBatchResult {
  const origin = options.origin ?? 'local';
  let batch!: BatchResult;
  let entry: ActivityEntry | null = null;
  doc.transact(() => {
    batch = applyCommands(doc, inputs, origin);
    if (options.actor) {
      const keepInverse = options.keepInverse ?? options.actor.actor === 'ai';
      entry = recordActivity(doc, { ...options.actor, summary: options.summary, nodeIds: batch.affectedNodeIds, inverse: keepInverse ? batch.inverse : undefined, coalesce: false }, origin);
    }
  }, origin);
  return { ...batch, entry };
}

export function listActivity(doc: Y.Doc): ActivityEntry[] {
  return getActivity(doc)
    .toArray()
    .filter((e) => ActivityEntrySchema.safeParse(e).success);
}

/** Entries touching a node, most recent first. */
export function activityForNode(entries: readonly ActivityEntry[], nodeId: string): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.nodeIds.includes(nodeId)) out.push(e);
  }
  return out;
}

export function findActivity(doc: Y.Doc, entryId: string): { entry: ActivityEntry; index: number } | undefined {
  const arr = getActivity(doc).toArray();
  const index = arr.findIndex((e) => e?.id === entryId);
  if (index < 0) return undefined;
  return { entry: arr[index]!, index };
}

export function markActivityReverted(doc: Y.Doc, entryId: string, origin: Origin = 'local'): boolean {
  const found = findActivity(doc, entryId);
  if (!found) return false;
  const activity = getActivity(doc);
  doc.transact(() => {
    activity.delete(found.index, 1);
    activity.insert(found.index, [{ ...found.entry, reverted: true }]);
  }, origin);
  return true;
}

export function canRevertActivity(entry: ActivityEntry): boolean {
  return !entry.reverted && (entry.inverse?.length ?? 0) > 0;
}

/**
 * Undo an activity entry by applying its inverse commands (with the given origin; `local`
 * makes the revert itself undoable). When `actor` is given the revert is logged too.
 */
export function revertActivity(
  doc: Y.Doc,
  entryId: string,
  origin: Origin = 'local',
  actor?: Actor,
): { entry: ActivityEntry; batch: BatchResult } {
  const found = findActivity(doc, entryId);
  if (!found) throw new DocError('VALIDATION', `Activity entry "${entryId}" not found.`, { entryId });
  if (found.entry.reverted) throw new DocError('VALIDATION', `Activity entry "${entryId}" was already reverted.`, { entryId });
  const inverse = found.entry.inverse ?? [];
  if (inverse.length === 0) throw new DocError('VALIDATION', `Activity entry "${entryId}" cannot be reverted.`, { entryId });
  let batch: BatchResult | undefined;
  doc.transact(() => {
    batch = applyCommands(doc, inverse, origin);
    markActivityReverted(doc, entryId, origin);
    if (actor) {
      recordActivity(doc, { ...actor, summary: `Annulation : ${found.entry.summary}`, command: 'revert', nodeIds: found.entry.nodeIds, coalesce: false }, origin);
    }
  }, origin);
  return { entry: found.entry, batch: batch! };
}
