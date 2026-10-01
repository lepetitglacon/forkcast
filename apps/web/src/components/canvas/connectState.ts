/**
 * A drag from the "+" handle that ends on the handle itself also produces a `click`;
 * the click handler uses this to ignore it (the connection end already handled it).
 */
let lastConnectEnd = 0;

export function markConnectEnd(): void {
  lastConnectEnd = performance.now();
}

export function connectEndedRecently(ms = 300): boolean {
  return performance.now() - lastConnectEnd < ms;
}
