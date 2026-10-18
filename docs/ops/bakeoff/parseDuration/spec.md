# Task: `parseDuration`

Write a single file `duration.mjs` **in this directory** exporting one function:

```js
export function parseDuration(input) { /* ... */ }
```

It turns a short human duration string into **whole seconds**, or returns
`null` when the input is not a valid duration. No dependencies, no I/O, no
side effects — a pure function.

## Grammar

1. The input is always a string. First `trim()` it.
2. After trimming, an empty string is invalid.
3. If what is left is **only digits** (`/^\d+$/`), it is a number of seconds:
   `"45"` → `45`, `"0"` → `0`.
4. Otherwise it must be one or more `<integer><unit>` groups, in the order
   hours, minutes, seconds, with **no spaces inside** the string. The units are
   `h`, `m`, `s` and are **case-insensitive**:
   - `"2m"` → `120`
   - `"2m30s"` → `150`
   - `"1h5m10s"` → `3910`
   - `"2M"` → `120`
5. Any other shape is invalid and returns `null` — including a bare number that
   follows a unit (`"1h30"`), an unknown unit (`"2x"`), out-of-order units
   (`"30s2m"`), a repeated unit (`"1m1m"`), words (`"abc"`), an empty string, and
   an internal space (`"1h 5m"`).
6. Minutes and seconds groups may be larger than 59 (`"90s"` → `90`); no
   normalisation or wrapping is needed.
7. Leading zeros are fine (`"05m"` → `300`).

## Acceptance

```bash
node docs/ops/bakeoff/parseDuration/test.mjs
```

must print `ALL PASS` and exit 0. **Do not modify `test.mjs`.** The test covers
16 cases drawn from the grammar above; if it fails, fix `duration.mjs`, not the
test.
