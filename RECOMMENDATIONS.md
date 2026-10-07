# Recommendations

Structural cuts only. Behavior stays. The map is [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Closed, do not reopen: `approveParitySwaps` and `approveDfoCertBalance` already return `boolean` on `SetupSession` (`types.ts`). An older note cited `/root/blade-rebirth` paths and treated that mismatch as open. It is not.

## 1. Break up `BuildPanel.svelte` (~1250 lines)

447 lines of script, 544 of markup, 249 of style. One `$effect(commit)` writes period, hours, FTE, gender, shifts, extras, function coverage, and certs. Import, export, clear, generate, and baggage resolve sit beside it.

Leave `BuildPanel.svelte` as the composer (~150 lines). Move:

| New file | Owns |
| --- | --- |
| `modules/build/setupForm.ts` | The field list, `commit`, `hydrate`. The `$effect` stays in the panel and calls these |
| `PeriodHours.svelte` | Start, weeks, seed, open, close |
| `FteGender.svelte` | FT / PT / LTSO / STSO / ESTI / MSTI and `positionGender` |
| `ShiftsEditor.svelte` | Add, remove, RDO, per-day times |
| `ExtraPositions.svelte` | Extra cards and per-shift counts |
| `FunctionCoverageForm.svelte` | Mode, pools, requirement bands |
| `CertPoolForm.svelte` | Pool letters and the DFO / BAG / PAX map |
| `SessionBar.svelte` | Generate, import, export, clear, resolve baggage |
| `GenerateResult.svelte` | The tally under the form |

Do not give each card its own copy of `session`. Pass the slice in, call `commit` on input.

## 2. Break up `ship/ebid.js` (~850 lines)

Five jobs, one file. `ShipPanel.svelte` (~650) should keep the form and the download. After this split, pull the preview table and the QA list out of the panel if it is still over ~400 lines.

| New file | Owns |
| --- | --- |
| `ebidColumns.js` | `EBID_HEADERS`, `EBID_COLUMNS`, `DAY_ABBR`, title lists |
| `ebidTime.js` | `toIsoDate`, `addDaysIso`, `weekdaySun0`, `toHHMM`, spans, hours. Delete the copies that duplicate `period/dates.js` and `shifts/time.js` where the behavior matches |
| `ebidRow.js` | `buildRowFromLine`, `rowsFromLines`, `rowsFromScheduler`, `rowToCells` |
| `ebidCsv.js` | `toCsv`, `rowsFromCsv`, `looksLikeEbidExport` |
| `ebidQa.js` | `runQa` |

`rowsFromJsonPayload` can live next to `ebidCsv.js` or in `ebidImport.js`. It must keep today's rule: fallback import does not write the session.

## 3. Split the generate modal on the section boundaries that already exist

`GenerateModal.svelte` is 103 lines of script and 388 of markup. `generateModal.ts` (~520) is the behavior.

| View | Model |
| --- | --- |
| `ModalTargets.svelte` | `targetModel`, `adjustTarget`, `selectTargetClass`, `generateAll`, `generateOneClass` |
| `ModalParity.svelte` | `parityBands`, `runParityCheck`, `approveParity` |
| `ModalDfo.svelte` | `runDfoPropose`, `approveDfo` |

Delete `getBandKey`, `getBandLabel`, and `formatRdos` from `generateModal.ts`. Call `shifts/shiftMath.js` and `actions/parityReport.js`. Three copies of `getBandKey` is how the band labels drift.

## 4. Pull the line factory out of `classGenerate.js` (~510)

`generateClass` should stay the orchestrator. Move `placeOpen` and `createLineForClass` (~180 lines, from the inner helpers) to `actions/lineFactory.js`. `buildLines.js` keeps the full-generate builder. Do not merge the two builders in this pass; they do not take the same arguments.

## 5. `parityReport.js` (~430)

`checkParity` is the bulk (about line 58–368). Move that scan to `actions/parityScan.js`. Leave `approveParitySwaps` and `attachParityReport` in `parityReport.js`.

## 6. Delete the dead half of `extraPositions.js` (~420)

`session.ts` does not call `attachExtraPositions`. Generate never sees `readExtraPositionsFromDom`. The HTML writer (`extraCardsHtml`, `#extra-pos-list`) has no host in the Svelte form.

Keep `opsFteYes`, `lineInOpsCoverage`, `normalizeExtraPosition`, `buildExtraPositionLines`. Remove `readExtraListFromDom`, `extraCardsHtml`, and `attachExtraPositions`. Same treatment, separate change, for `certsLegacy.js` DOM ids (`#cfg-cert-*`) once nothing in `allocation.js` or `certs.js` references them. Do not reattach them to "restore Alpha."

## 7. One revision signal

Build, Lines, Coverage, Reports, Ship, Present, and Teams each keep a local `tick` and subscribe with `onSessionLines`. Export a `sessionRev` rune (or a number the bus increments) from `sessionBus.js` and `$derived` off that. Then the bus comment and the panels agree.

## 8. Type the state you already have

`defaultSetupState()` is the shape. `SetupState` is not. Expand `SetupState` to those keys, and add an `AttachedSession` for the methods `createEmptySession` actually assigns (`getShift`, `timeToMin`, `generateFunctionAssignments`, `resolveBagDuties`, `teams`, …). Stop casting `session as` in every panel. Do this after the splits, or the type edits will collide with the moves.

## 9. Tests, once a file is pure

No tests exist. First targets, in this order, because they have no DOM:

1. `validateGenerateInputs`
2. `period/dates.js`
3. `ebid` `rowToCells` + `runQa` (after the split)
4. `fte/gender.js` `policyFor` / `plannedHeadcount`
5. `function-coverage/lib/migrate.js`

Do not snapshot `BuildPanel`.

## Leave alone

- `LinesPanel.svelte` (~455). Behavior is in `rows.js` and `edit.js`.
- `assign.js` (~360) and `certifiedPools.js` (~329). Already one job each. Next cut inside `assign.js` is the per-day rotation loop, not a new folder.
- `generate.js` (~194). It is the coordinator. Keep it that way.
- `src/app.css` (~309). Shell tokens. Panel styles stay scoped.
- `ReportsPanel.svelte` and `PresentPanel.svelte`. They are small and read-only. Sharing a snapshot helper is optional, not a split.

## Do not

- Add drag-and-drop to Teams to match an old README line. The select is the UI.
- Read `setupStore.fte` / `.period` / `.functionCoverage`. Writers are `BuildPanel.commit` and `sessionIo.mirrorStore`. Readers must use `session.state`.
- Introduce a second line store, a CDN, or a vendored copy of a library the lockfile does not already build.
