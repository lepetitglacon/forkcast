/** Width of the inset drawers (rem); the toolbar, controls and minimap keep clear of them. */
export const DRAWER_WIDTH_REM = 22;
/** Horizontal room taken by an open drawer, margins included. */
export const DRAWER_ROOM = `calc(${DRAWER_WIDTH_REM}rem + 1.25rem)`;

export type DrawerSide = 'left' | 'right';
