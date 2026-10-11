/**
 * Client-side UUID v4 generation for sync-ready primary keys.
 *
 * Uses crypto.getRandomValues — cryptographically secure on every target
 * where the global exists (Node 19+, modern browsers).
 *
 * IMPORTANT: Hermes (React Native) does NOT provide globalThis.crypto, so on
 * device we fall back to expo-crypto via a LAZY require. The require is lazy
 * (inside the function, never at module top level) because this file is
 * imported by drizzle-kit's schema tooling under plain Node, where a native
 * module import would break the bundler. Under Node the global always exists,
 * so the require branch never executes there.
 *
 * Math.random() is cryptographically weak and must never be used for IDs.
 */
function randomUUID(): string {
  const g = globalThis as {
    crypto?: { getRandomValues?: (array: Uint8Array) => Uint8Array };
  };
  if (g.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    g.crypto.getRandomValues(bytes);
    return formatV4(bytes);
  }
  // Device fallback: expo-crypto ships inside Expo Go and dev builds.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomUUID: expoRandomUUID } = require('expo-crypto') as {
    randomUUID: () => string;
  };
  return expoRandomUUID();
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
