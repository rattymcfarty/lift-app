# data/ — local repository layer

Typed data-access functions over the Drizzle client (`../db/client.ts`).
Repositories own queries, transactions, and soft-delete filtering
(`deletedAt IS NULL`); screens never touch Drizzle directly.

Also owns the KB snapshot store (Phase 2): atomic verified install of
`kb-bundle-<v>.json` (expo-crypto sha256 → schema validate → swap).

Lands in Phase 1.
