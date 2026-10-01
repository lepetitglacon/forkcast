/** Direction in which the tree grows from its root. */
export type Orientation = 'lr' | 'rl' | 'tb' | 'bt';
export type Side = 'left' | 'right' | 'top' | 'bottom';
export type NavigateDirection = 'parent' | 'child' | 'previous' | 'next';

export const ORIENTATIONS: readonly Orientation[] = ['lr', 'rl', 'tb', 'bt'];

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  lr: 'De gauche à droite',
  rl: 'De droite à gauche',
  tb: 'De haut en bas',
  bt: 'De bas en haut',
};

export function isHorizontal(orientation: Orientation): boolean {
  return orientation === 'lr' || orientation === 'rl';
}

/** Side of a card where its children are attached (and where the "+" handle sits). */
export function childSide(orientation: Orientation): Side {
  switch (orientation) {
    case 'lr':
      return 'right';
    case 'rl':
      return 'left';
    case 'tb':
      return 'bottom';
    case 'bt':
      return 'top';
  }
}

/** Side of a card where the edge coming from its parent arrives. */
export function parentSide(orientation: Orientation): Side {
  switch (orientation) {
    case 'lr':
      return 'left';
    case 'rl':
      return 'right';
    case 'tb':
      return 'top';
    case 'bt':
      return 'bottom';
  }
}

const KEY_SIDE: Record<string, Side> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'top',
  ArrowDown: 'bottom',
};

/**
 * Arrow key → tree navigation, following the orientation: the arrow pointing to the parent
 * side goes to the parent, the one pointing to the children side goes to the first child,
 * the two other arrows move between siblings.
 */
export function arrowToDirection(orientation: Orientation, key: string): NavigateDirection | null {
  const side = KEY_SIDE[key];
  if (!side) return null;
  if (side === parentSide(orientation)) return 'parent';
  if (side === childSide(orientation)) return 'child';
  return side === 'left' || side === 'top' ? 'previous' : 'next';
}
