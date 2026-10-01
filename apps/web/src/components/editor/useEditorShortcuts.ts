import { useEffect, useRef } from 'react';
import type { NodeActions } from '@/docs/useNodeActions';
import { arrowToDirection } from '@/lib/orientation';
import { useUiStore } from '@/store/ui';

const TEXT_FIELDS = 'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
/** Controls that use Space / Enter / Tab / arrows natively. */
const CONTROLS = 'button, a[href], [role="button"], [role="switch"], [role="radio"], [role="tab"], [role="checkbox"], [role="slider"]';

function closest(target: EventTarget | null, selector: string): boolean {
  return target instanceof Element && target.closest(selector) !== null;
}

/** Mind-map style keyboard editing, active while no text field (or dialog) has the focus. */
export function useEditorShortcuts(actions: NodeActions, readOnly: boolean): void {
  const ref = useRef({ actions, readOnly });
  useEffect(() => {
    ref.current = { actions, readOnly };
  }, [actions, readOnly]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (closest(event.target, TEXT_FIELDS)) return;
      const onControl = closest(event.target, CONTROLS);
      const { actions: a, readOnly: ro } = ref.current;
      const state = useUiStore.getState();
      const selected = state.selectedId;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key;

      if (mod && key.toLowerCase() === 'z') {
        event.preventDefault();
        if (ro) return;
        if (event.shiftKey) a.redo();
        else a.undo();
        return;
      }
      if (mod && key.toLowerCase() === 'y') {
        event.preventDefault();
        if (!ro) a.redo();
        return;
      }
      if (key === '?' || (key === '/' && event.shiftKey)) {
        event.preventDefault();
        state.setHelpOpen(!state.helpOpen);
        return;
      }
      if (key === 'Escape') {
        if (state.renamingId) a.cancelRename();
        else if (state.highlightedKey) state.clearHighlight();
        else if (selected) a.select(null);
        return;
      }
      if (mod || event.altKey) return;

      const direction = arrowToDirection(state.orientation, key);
      if (direction) {
        if (onControl) return;
        event.preventDefault();
        a.navigate(direction);
        return;
      }
      if (!selected) return;
      switch (key) {
        case 'Tab':
          if (onControl) return; // keep keyboard navigation between buttons
          event.preventDefault();
          if (!ro) a.addChild(selected);
          return;
        case 'Enter':
          if (onControl) return;
          event.preventDefault();
          if (!ro) a.addSibling(selected);
          return;
        case 'F2':
          event.preventDefault();
          if (!ro) a.startRename(selected);
          return;
        case 'Delete':
        case 'Backspace':
          event.preventDefault();
          if (!ro) a.requestDelete(selected);
          return;
        case ' ':
          if (onControl) return;
          event.preventDefault();
          a.toggleCollapse(selected);
          return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
