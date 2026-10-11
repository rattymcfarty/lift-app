/**
 * Client-side UUID v4 generation for sync-ready primary keys.
 *
 * Uses crypto.getRandomValues. On Hermes (React Native) Web Crypto is NOT
 * built in — the app entry (app/_layout.tsx) loads the
 * react-native-get-random-values polyfill before this module is imported.
 * Under Node 19+ and modern browsers, globalThis.crypto exists natively.
 *
 * Deliberately imports no native modules: this file is imported by
 * drizzle-kit's schema tooling under Node, where native imports break the
 * bundler. expo-crypto's randomUUID() uses getRandomValues internally, so
 * this is equivalent security without the native dependency.
 */
export function newId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  // Set version (4) and variant (10xx) bits per RFC 4122.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return (
    `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}` +
    `-${hex.slice(16, 20)}-${hex.slice(20)}`
  );
}
