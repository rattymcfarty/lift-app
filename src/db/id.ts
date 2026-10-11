/**
 * Client-side UUID v4 generation for sync-ready primary keys.
 *
 * Uses crypto.getRandomValues — cryptographically secure on every target.
 *
 * On Hermes (React Native) the global is provided by the
 * react-native-get-random-values polyfill, imported FIRST in app/_layout.tsx
 * (before any module that generates IDs can run). Under Node (drizzle-kit
 * schema tooling) the global exists natively (Node 19+).
 *
 * There is deliberately no Math.random() fallback and no lazy native-module
 * require: IDs must be cryptographically secure, so a missing global fails
 * loudly here instead of degrading silently — and a static require() of an
 * uninstallable module would break Metro bundling (it resolves every
 * literal require, even unreachable ones).
 */
function randomUUID(): string {
  const getRandomValues = (
    globalThis as {
      crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
    }
  ).crypto?.getRandomValues;
  if (!getRandomValues) {
    throw new Error(
      'crypto.getRandomValues is not available — IDs cannot be generated securely',
    );
  }
  const bytes = new Uint8Array(16);
  getRandomValues(bytes);
  return formatV4(bytes);
}

function formatV4(bytes: Uint8Array): string {
  // Set version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}` +
    `-${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}

export function newId(): string {
  return randomUUID();
}
