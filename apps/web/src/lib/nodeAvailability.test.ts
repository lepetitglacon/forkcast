import { describe, expect, it } from 'vitest';
import { buildSnapshot, createDocFromJson, exampleTreeJson } from '@forkcast/doc';
import { getNodeAvailability } from './nodeAvailability';

const tree = buildSnapshot(createDocFromJson(exampleTreeJson()));
const editable = { readOnly: false, collapsed: false };

describe('getNodeAvailability (contextual toolbar)', () => {
  it('returns null without a (valid) selection', () => {
    expect(getNodeAvailability(tree, null, editable)).toBeNull();
    expect(getNodeAvailability(tree, 'missing', editable)).toBeNull();
  });

  it('root: no sibling, no delete, no optional; leaf disabled because it has children', () => {
    const a = getNodeAvailability(tree, 'root', editable)!;
    expect(a).toMatchObject({ isRoot: true, addChild: true, addSibling: false, remove: false, optionalAvailable: false, leafDisabled: true, collapseAvailable: true });
  });

  it('child of an AND node can be optional; child of an OR node cannot', () => {
    expect(getNodeAvailability(tree, 'fraud', editable)).toMatchObject({ optionalAvailable: true, optional: true, collapseAvailable: false, leafDisabled: false });
    expect(getNodeAvailability(tree, 'stripe', editable)).toMatchObject({ optionalAvailable: false, addSibling: true, remove: true });
  });

  it('OR node with children: kind change but no leaf, collapse follows the view state', () => {
    expect(getNodeAvailability(tree, 'psp', { readOnly: false, collapsed: true })).toMatchObject({
      kind: 'or',
      changeKind: true,
      leafDisabled: true,
      collapseAvailable: true,
      collapsed: true,
    });
  });

  it('read-only: only collapse remains', () => {
    const a = getNodeAvailability(tree, 'psp', { readOnly: true, collapsed: false })!;
    expect(a).toMatchObject({ canEdit: false, addChild: false, addSibling: false, changeKind: false, optionalAvailable: false, rename: false, remove: false, collapseAvailable: true });
  });
});
