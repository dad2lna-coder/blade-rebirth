# Oracle

Alpha `bright-garden` at `17d5575`. Recorded before any logic was copied.

`npm test` passed. Every script in Alpha `package.json` `test` exited 0.

Also run, not part of that script:

| File | Result |
| --- | --- |
| `tests/test-dash-duty-coverage.mjs` | 2 pass, 2 fail |
| `tests/test-io-roundtrip.mjs` | pass |

The two dash failures are on Alpha itself. Both are Reports deviation totals (`0 !== 1`). Coverage views in that file pass. Do not "fix" them while porting. Copy the same result.

## Where the move is

Phase 0 is this file. Phase 1 is `tauri-core-app/` and `onedrive-shared-modules/`. The shell renders "not wired". It is not the running app.

Phase 2.1 and 2.2 are in `onedrive-shared-modules/src`. Shared time and dates are copied whole. Shift math is split into `shiftClock.js`, `shiftNormalize.js`, `rdoDays.js`, `rdoBlock.js`, `rdoAssign.js`, `slots.js`. Function bodies are Alpha's. `src/` and `modules/` of the current Svelte app are unchanged.

`npm run test:logic` runs the copied gates: shared smoke, the split-shift test, and the logic half of `test-rdo-modes`. The generate half of that file stays on Alpha until `buildLines.js` and `generate.js` are copied.

Next change is phase 2.3: `buildLines.js` and `headcounts.js`.

A local compare of 2,013 `assignRdoDays` / `assignBlockRdos` placements, plus normalize, split coverage, and locked-pin notes, matched Alpha `17d5575` after the split. That compare is not a committed test because it imports the Alpha checkout.
