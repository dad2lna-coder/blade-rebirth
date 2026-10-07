# Migration plan

Move BLADE_Alpha `bright-garden` (`17d5575`) onto the Svelte module tree without changing a scheduling result.

Status: phase 0, 1, 2.1, and 2.2 are in the tree. See [ORACLE.md](ORACLE.md). Do not restart them.
 Behavior spec: [PORT-FROM-ALPHA.md](PORT-FROM-ALPHA.md). Folder shape: that file's target tree. This file is the order of work.

Alpha `npm test` is the oracle. Rebirth has no tests. A Svelte screen is not allowed to call a function until the Alpha test that covers that function is green against the new path.

## Rule

Copy logic. Do not rewrite it. A move commit may only change import paths and split a file at a function boundary. Scoring, seed order, partner arguments, and early returns stay byte-for-byte until a test proves the split.

Svelte 5 views collect input and render output. They do not place RDOs, assign duties, or decide sex. Alpha's lines table is Svelte 4. Port `row-model.js`. Do not port `LinesTable.svelte`.

One cluster per change. The cluster's tests are green before the next cluster starts.

## What already matches

Leave these alone until a failing test says otherwise.

eBid (`ship/ebid.js`), `time.js`, `dates.js`, `slots.js`, function-coverage `pools.js` / `shifts.js` / `migrate.js`, cert pool normalize, parity (plus rebirth's skip when gender is ignored), Sun–Sat columns via `weekdaySun0`, coverage dash / opsFte gate in `counts.js`.

## What rebirth must not keep

These are the regressions. They are already wrong relative to Alpha HEAD.

| Rebirth does this | Alpha HEAD does this | Test |
| --- | --- | --- |
| TSO, then LTSO, then STSO | STSO, then LTSO with STSO partners, then TSO | `test-crew-groups-rdo-sex.mjs`, `test-rdo-modes.mjs` |
| Copies `rdoHard` or a seed block | `assignRdoDays` / `assignBlockRdos` | `test-rdo-modes.mjs` |
| No `rdoBlock`, `rdoPins`, `rdoMode` | 4×10 pin is not glued to the block. 5×8 pin sits inside the pair. STSO shares only the pin | `test-rdo-modes.mjs` |
| LTSO sex is pool order | Opposite the STSO majority on that shift | `test-crew-groups-rdo-sex.mjs` |
| Female leadership days are not scored | Females first. Gaps × 1000, then day spread, then pair reuse | `test-rdo-modes.mjs` |
| Extras and training use old `rdoDaysFor` | Both call `assignRdoDays` | `test-crew-groups-rdo-sex.mjs` |
| `isLineScheduleLocked` is missing | Rules on `state.scheduleLocks` freeze generate, class generate, parity, DFO, rebalance, swap | `test-schedule-locks.mjs` |
| Class generate paints PAX locally | `generateFunctionAssignments` then `assignCertPools` | `test-generate-modal.mjs`, `test-function-coverage.mjs` |
| `lineCoversSlot` uses one span | Both split segments, overnight wrap, weekday from the start date | `test-split-shift.mjs`, `test-dash-duty-coverage.mjs` |
| Certified pools include shortfall and dash | Those lines are skipped | `test-function-coverage.mjs`, `test-dash-duty-coverage.mjs` |
| `getRotationDuty` drops `"-"` | Dash is a real duty | `test-dash-duty-coverage.mjs` |

`test-dash-duty-coverage.mjs` and `tests/test-io-roundtrip.mjs` are not in Alpha's `npm test` script. Add both to the new `npm test`. They guard the weekday map and the dash exclusion.

## What rebirth added and the port must keep

Do not "correct" these back to Alpha.

- `positionGender`: `ignoreGender`, `dropM`, `dropF` per FT, PT, LTSO, STSO, and each extra. `positionMatchesSex` stays in certified pools and assign. Add the shortfall and dash exclusions on top of it. Do not go back to `l.sex === sex` only.
- Parity skipped when the class ignores gender.
- DFO moves require an explicit `M` or `F`. Alpha's `sex || "M"` stays out.
- Ship fallback import does not write the session.
- `setupStore` is not a reader. Delete it during the move. Session state is the source.
- Teams move with a select until the Teams module lands. Drag calls the same `moveMember` as the select.

## Phases

### 0. Oracle

On a clean Alpha checkout at `17d5575`, run `npm test` and record the pass. That output is the baseline. Do not start phase 1 against a dirty Alpha tree.

Copy `tests/` into the new module repo. Change only the import paths, in the same commit as the file move they point at. The one HTML assert in `test-rdo-modes.mjs` (`rdoConstraintHtml`) moves to a later view test. The rest of that file stays on `logic/`.

### 1. Lay the folders down empty

Create the tree in [PORT-FROM-ALPHA.md](PORT-FROM-ALPHA.md). No behavior. `tauri-core-app` is a shell that renders "not wired" per slot. `onedrive-shared-modules/build.js` emits `dist/<id>/index.js` from a module that exports `init`. Core does not calculate.

### 2. Move logic, still no Svelte math

Destination is `onedrive-shared-modules/src/<module>/logic/`. Copy the Alpha file. Then split only if the file is over 220 lines, at the boundaries already named in the port doc. Re-export the old function names from the split so tests do not change assertions.

Order inside this phase. Each row is one change, and its tests must pass before the next row.

| # | Copy from Alpha | Lands in | Gate |
| --- | --- | --- | --- |
| 2.1 | `shared/utils/time.js`, `dates.js` | `shared/logic/` | import smoke |
| 2.2 | `shiftMath.js`, `rdoBlock.js`, `slots.js` | `build/logic/shiftClock.js`, `rdoDays.js`, `rdoBlock.js`, `rdoAssign.js`, `slots.js` | `test-rdo-modes.mjs` (logic only), `test-split-shift.mjs` |
| 2.3 | `buildLines.js`, `headcounts.js` | `tsoLines.js`, `supervisoryLines.js`, `rdoScore.js`, `headcounts.js` | `test-rdo-modes.mjs`, `test-crew-groups-rdo-sex.mjs` |
| 2.4 | `extraPositions.js` `rdoDaysFor`, `trainingClasses.js` `rdoDaysFor` | `extras.js`, `training.js` | `test-crew-groups-rdo-sex.mjs` |
| 2.5 | `scheduleLocks.js`, `rebalanceFt.js` `getLinesForClass` | `locks.js`, `classMatch.js` | `test-schedule-locks.mjs` |
| 2.6 | `generate.js`, `classGenerate.js` | `generate.js`, `classGenerate.js`, `classLine.js`, `scheduleForLine.js` | `test-generate-modal.mjs` |
| 2.7 | `function-coverage/lib/{duty,pools,shifts,assign,certifiedPools,migrate}.js` | `build/logic/function/` | `test-function-coverage.mjs`, `test-resolve-bag.mjs`, `test-dash-duty-coverage.mjs` |
| 2.8 | `certAssign.js`, `certs.js` normalize only | `certAssign.js`, `certs.js` | `test-function-coverage.mjs` |
| 2.9 | `parityReport.js`, `dfoCertBalance.js` | `parity.js`, `dfoCert.js` | `test-generate-modal.mjs` |
| 2.10 | `rebalanceFt.js`, `rebalancePt.js`, `rebalanceDfo.js`, `swapSex.js` | matching logic files | `test-dfo-rebalance.mjs`, `test-swap-sex.mjs` |
| 2.11 | `ebid.js` | `ship/logic/ebid*.js` | `test-ebid-upload.mjs` |
| 2.12 | `lines-table/row-model.js`, `coverage/utils/hourly.js`, `coverage/components/cuts.js` | `lines/logic/rows.js`, `coverage/logic/hourly.js`, `cuts.js` | `test-lines-table-edits.mjs`, `test-filter-semantics.mjs`, `test-coverage-cuts.mjs`, `test-dash-duty-coverage.mjs` |
| 2.13 | `reports/*.js` math, `demand-capacity/{parse,aggregate,staffing}.js` | `reports/logic/`, `demand/logic/` | `test-demand-capacity.mjs` |
| 2.14 | `team-builder/utils/{autoForm,pool,team,phase,extraTeams}.js` | `teams/logic/` | diff against current `teams/form.js` in the same change. Keep rebirth select behavior until the view exists. Do not assume the scorers match |
| 2.15 | `bid-planner/js/{calendar,rules,conflicts,validation,scheduler}.js` plus `config/*.json` | `plan/logic/` | `test-bid-planner.mjs` |
| 2.16 | `js/io.js` envelope fields only | `build/actions/io.js` | `test-io-roundtrip.mjs`. Extend for locks, RDO fields, mod-set day map |

Gender policy from rebirth `fte/gender.js` is applied in 2.3 and 2.7 as a wrapper around the copied sex pick, not as a rewrite of `pickBalancedRdos`. If a copied test fails because a line has no sex, the wrapper is wrong. Do not edit the scorer.

`bands.js`, `extras.js` DOM, `render.js`, `shiftsTable.js`, `paint.js`, `bridge.js`, `generateModal.js` HTML, and `rdoConstraintUi.js` are not copied. Views replace them.

Miles (`test-miles-portfolio.mjs`) stays on Alpha until `plan` reads `bid-planner/index.js` and confirms BIDPLANNER replaced that screen. Do not build both.

### 3. Session attach

`shared/logic/session.js` attaches in this order: defaults, shift clock, RDO assign, locks, headcounts, TSO lines, supervisory lines, training, extras, certs, function coverage, generate, class generate, parity, DFO cert, rebalance, sex swap.

`attachExtraPositions` is not called. `readCertConfigFromDom`, `readShiftsFromDom`, `renderAll`, and `lines:request-render` are not attached. UI refresh is `bus.emit("session:lines")` from actions only.

After 2.6 and this attach, one generate with a fixed seed must match Alpha's line ids, sexes, `rdoDays`, and functions. That fixture is checked in by running the existing generate tests, not by a new snapshot of HTML.

### 4. Svelte views

Only after phase 2's gate for that module is green. Views take the session as a prop. They do not import a second copy of a formula.

| Module | Views | May call |
| --- | --- | --- |
| build | Period, FTE, shifts, RDO constraint, extras, function coverage, certs, generate modal (targets / parity / DFO) | `commit`, `generate`, `generateClass`, `checkParity`, `approveParitySwaps`, `proposeDfoCertBalance`, `approveDfoCertBalance` |
| lines | filters, table, day cell | `rowsFromSession`, `writeDayDuty`, `writeDayTime`, `writeInlineEdit` |
| coverage | matrix, cuts | `computeHourlyByDow`, `applyCoverageCutsToLines` |
| reports | one view per report | the report's `compute*` / `render` data function. Print is a view concern |
| demand | chart | `parseVolumeRows`, `bucketFlights`, `computeStaffCapacity` |
| ship | form, preview, QA | `rowsFromScheduler`, `toCsv`, `runQa`. Fallback parse does not call `applySession` |
| present | snapshot | read `session.state` only |
| teams | auto-form, boards, unassigned | `autoFormTeams`, `writeTeams`, `moveMember` |
| plan | timeline, rules | `generateSchedule`, conflict list. Stored beside the line session, not inside it |

`BuildForm.svelte` is a composer. Each card is its own file, under 250 lines of script plus markup. The modal is three views. No card computes an RDO.

Wire `positionGender` on the FTE card. The copied engine reads `state.positionGender`. The card does not reimplement `policyFor`.

### 5. Core

Last. `moduleLoader` reads `dist/<id>/manifest.json` and `index.js`. `registry` drops a module whose `init` is missing. `AppShell` is mast, stage tabs, and a slot. F-keys and theme stay in the shell. They are not per module.

`eventBus` events are only `session:lines`, `session:setup`, and `nav:stage`. Delete the Alpha window names once no test listens.

Vendored `exceljs` and `sortable` live under `onedrive-shared-modules/vendor/` and are copied into the module `dist/` that uses them. No Luxon, no dayjs, no CDN. Svelte in every `dist/index.js` is the same major the core import map uses.

### 6. Done

All of these are true:

- Alpha's `npm test` list, plus `test-dash-duty-coverage.mjs` and `test-io-roundtrip.mjs`, pass against `logic/`.
- A fixed-seed generate matches Alpha on ids, sex, `rdoDays`, function, and cert pool.
- No `logic/` file is over 220 lines. No view file is over 250 lines of script plus markup.
- No view file contains `assignRdoDays`, `pickBalancedRdos`, `hourSpread`, or `femaleGapCount`.
- `isLineScheduleLocked` is attached.
- Class generate calls `generateFunctionAssignments`.
- Generate order is STSO, LTSO with partners, TSO.
- Gender ignore and drop still change who is counted, and the RDO tests still pass when gender is not ignored.

## Do not

- Port `render.js`, `shiftsTable.js`, or `generateModal.js` to "save time."
- Change generate order because TSO-first "reads better."
- Glue a 4×10 pin to its RDO block.
- Weight free LTSO seats by TSO lines when STSO partners exist.
- Default a blank sex to `M`.
- Let a fallback eBid import replace live lines.
- Add a chat module or a graph module. Those names were a shape sample.
- Start the Tauri shell before phase 2.6 is green.
