import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act } from 'react-dom/test-utils';
import { createRoot, type Root } from 'react-dom/client';
import type * as Y from 'yjs';
import { addChild, createDoc, recordActivity, revertActivity } from '@forkcast/doc';
import { useUiStore } from '@/store/ui';
import { useAssistantActivity } from './useAssistantActivity';

const TREE_KEY = 'local:test';
function Probe({ doc }: { doc: Y.Doc }) {
  useAssistantActivity(doc, TREE_KEY, revertNoop);
  return null;
}

function revertNoop(): boolean {
  return true;
}

describe('useAssistantActivity', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    useUiStore.getState().resetTransient();
    useUiStore.setState({ lastSeenActivity: {} });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('marks existing entries as seen on first open, then highlights new assistant changes', () => {
    const doc = createDoc({ title: 'T', rootId: 'root' });
    const first = recordActivity(doc, { actor: 'ai', summary: 'old', nodeIds: ['root'], inverse: [] });
    act(() => root.render(<Probe doc={doc} />));
    expect(useUiStore.getState().lastSeenActivity[TREE_KEY]).toBe(first.id);
    expect(useUiStore.getState().aiHighlight).toEqual({});

    const added = addChild(doc, { parentId: 'root', node: { label: 'Par IA' } }, 'mcp');
    let entry: ReturnType<typeof recordActivity> | undefined;
    act(() => {
      entry = recordActivity(doc, {
        actor: 'ai',
        tool: 'add_node',
        summary: 'Ajout de « Par IA »',
        nodeIds: added.affectedNodeIds,
        inverse: added.inverse,
      });
    });
    const state = useUiStore.getState();
    expect(state.lastSeenActivity[TREE_KEY]).toBe(entry!.id);
    expect(Object.keys(state.aiHighlight).sort()).toEqual([...added.affectedNodeIds].sort());
    expect(state.aiHighlight[added.result.id]).toBeGreaterThan(Date.now());

    // Reverting through the activity log is itself recorded as seen without re-highlighting.
    act(() => {
      useUiStore.getState().pruneAiHighlight(Date.now() + 60_000);
      revertActivity(doc, entry!.id, 'local');
    });
    expect(useUiStore.getState().aiHighlight).toEqual({});
  });

  it('ignores user and import entries', () => {
    const doc = createDoc({ title: 'T', rootId: 'root' });
    act(() => root.render(<Probe doc={doc} />));
    act(() => {
      recordActivity(doc, { actor: 'user', summary: 'manual', nodeIds: ['root'], inverse: [] });
    });
    act(() => {
      recordActivity(doc, { actor: 'import', summary: 'import', nodeIds: ['root'], inverse: [] });
    });
    expect(useUiStore.getState().aiHighlight).toEqual({});
    expect(useUiStore.getState().lastSeenActivity[TREE_KEY]).toBeDefined();
  });
});
