import { describe, expect, it } from 'vitest';
import { arrowToDirection, childSide, parentSide } from './orientation';

describe('orientation', () => {
  it('maps arrows to tree navigation following the orientation', () => {
    expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((k) => arrowToDirection('lr', k))).toEqual(['parent', 'child', 'previous', 'next']);
    expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((k) => arrowToDirection('rl', k))).toEqual(['child', 'parent', 'previous', 'next']);
    expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((k) => arrowToDirection('tb', k))).toEqual(['previous', 'next', 'parent', 'child']);
    expect(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map((k) => arrowToDirection('bt', k))).toEqual(['previous', 'next', 'child', 'parent']);
    expect(arrowToDirection('lr', 'a')).toBeNull();
  });

  it('puts the "+" handle on the children side', () => {
    expect([childSide('lr'), childSide('rl'), childSide('tb'), childSide('bt')]).toEqual(['right', 'left', 'bottom', 'top']);
    expect([parentSide('lr'), parentSide('rl'), parentSide('tb'), parentSide('bt')]).toEqual(['left', 'right', 'top', 'bottom']);
  });
});
