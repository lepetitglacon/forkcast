import type { ActivityEntry } from '@forkcast/shared';
import { initials } from './utils';

export type HistoryFilter = 'all' | 'people' | 'ai';

export const HISTORY_FILTER_LABELS: Record<HistoryFilter, string> = {
  all: 'Tout',
  people: 'Personnes',
  ai: 'IA',
};

export const AI_LABEL = 'Assistant IA';

/** Entries matching the filter, newest first. */
export function filterHistory(entries: readonly ActivityEntry[], filter: HistoryFilter): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (filter === 'ai' && e.actor !== 'ai') continue;
    if (filter === 'people' && e.actor === 'ai') continue;
    out.push(e);
  }
  return out;
}

/**
 * History shown in the drawer: the whole tree when no node is selected, otherwise only the
 * entries touching that node; the author filter applies on top. Newest first.
 */
export function scopeHistory(entries: readonly ActivityEntry[], nodeId: string | null, filter: HistoryFilter): ActivityEntry[] {
  const scoped = nodeId ? entries.filter((e) => e.nodeIds.includes(nodeId)) : entries;
  return filterHistory(scoped, filter);
}

/** Number of entries per filter chip within a scope. */
export function historyCounts(entries: readonly ActivityEntry[], nodeId: string | null): Record<HistoryFilter, number> {
  let all = 0;
  let ai = 0;
  for (const e of entries) {
    if (nodeId && !e.nodeIds.includes(nodeId)) continue;
    all++;
    if (e.actor === 'ai') ai++;
  }
  return { all, people: all - ai, ai };
}

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const dayFormat = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Aujourd’hui", "Hier", or the full date. */
export function dayLabel(at: number, now: number): string {
  const day = startOfDay(at);
  const today = startOfDay(now);
  if (day === today) return 'Aujourd’hui';
  const yesterday = startOfDay(today - 12 * 3600 * 1000);
  if (day === yesterday) return 'Hier';
  const text = dayFormat.format(new Date(at));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface HistoryGroup {
  key: string;
  label: string;
  entries: ActivityEntry[];
}

/** Groups consecutive entries (already sorted newest first) by calendar day. */
export function groupByDay(entries: readonly ActivityEntry[], now: number): HistoryGroup[] {
  const groups: HistoryGroup[] = [];
  for (const entry of entries) {
    const key = String(startOfDay(entry.at));
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, label: dayLabel(entry.at, now), entries: [entry] });
  }
  return groups;
}

const relativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** "à l’instant", "il y a 5 minutes", "hier"… */
export function formatRelativeTime(at: number, now: number): string {
  const seconds = Math.round((at - now) / 1000);
  if (Math.abs(seconds) < 45) return 'à l’instant';
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return relativeFormat.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relativeFormat.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relativeFormat.format(days, 'day');
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return relativeFormat.format(months, 'month');
  return relativeFormat.format(Math.round(days / 365), 'year');
}

/** Display name of the author ("Assistant IA", the person, "Import"…). */
export function authorLabel(entry: ActivityEntry): string {
  if (entry.actor === 'ai') return AI_LABEL;
  if (entry.actorLabel) return entry.actorLabel;
  return entry.actor === 'import' ? 'Import' : 'Quelqu’un';
}

/** For assistant entries: the token / client name that follows "Assistant IA · ". */
export function assistantDetail(entry: ActivityEntry): string | null {
  if (entry.actor !== 'ai' || !entry.actorLabel) return null;
  const parts = entry.actorLabel.split(' · ');
  const detail = parts.length > 1 ? parts.slice(1).join(' · ') : entry.actorLabel;
  return detail && detail !== AI_LABEL ? detail : null;
}

export function authorInitials(entry: ActivityEntry): string {
  return initials(authorLabel(entry));
}
