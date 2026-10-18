# Model bake-off fixtures

Small, self-contained coding tasks used to rank the free OpenCode models in
`scripts/opencode/models.json` (`pool_order`) and the table in
`docs/ops/DELEGATION.md` §6. Re-run a bake-off whenever the pool changes.

## Protocol

1. Commit the fixture (it has to be in the worktree the helper gets).
2. One run per model, serially — the pool lock allows one at a time:

   ```bash
   scripts/delegate.sh run bake-<model> \
     "Read docs/ops/bakeoff/<task>/spec.md and implement it. The acceptance
      test docs/ops/bakeoff/<task>/test.mjs must pass: node
      docs/ops/bakeoff/<task>/test.mjs must print ALL PASS. Do not modify the
      test file. Work only in this directory." \
     -m opencode/<model> -t 3
   ```

3. Record: pass/fail, wall-clock time, and whether the test file or the spec was
   touched (`git diff` in the worktree). A hardcoded lookup table that satisfies
   the visible cases fails review even when the test passes.
4. `scripts/delegate.sh clean bake-<model>`, then update the table in
   `docs/ops/DELEGATION.md` §6 and the model's place in `pool_order`.

Pass bar: `node test.mjs` prints `ALL PASS` with `spec.md` and `test.mjs`
unchanged.

## Tasks

| Task | What it measures |
|---|---|
| `parseDuration/` | Parsing a small text grammar exactly — 16 cases, no library, one pure function |
