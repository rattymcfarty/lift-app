/**
 * Client-side UUID v4 generation for sync-ready primary keys.
 * Prefers crypto.randomUUID(); falls back to a Math.random-based v4
 * so ID generation never crashes on older runtimes.
 */
export function newId(): string {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
