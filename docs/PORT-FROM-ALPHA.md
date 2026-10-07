# Port from BLADE_Alpha `bright-garden`

Planning only. Do not treat this file as permission to paste Alpha UI into rebirth.

Work order: [MIGRATION.md](MIGRATION.md). This file is the behavior list that order must not regress.

Compared:

- Alpha: `dad2lna-coder/BLADE_Alpha` @ `bright-garden` `17d5575` (2026-10-07). "keep female leadership on duty; spread leadership RDOs."
- Rebirth: `dad2lna-coder/blade-rebirth` before this note. Svelte 5 shell. Engine is an older cut of the same files.

Alpha's own `docs/APP-MAP.md` is behind that HEAD. It does not list `rdoBlock.js`, `rdoConstraintUi.js`, or the eBid UI. Trust the files named here.

Behavior reference is Alpha. Structure reference is the tree at the bottom. Copy math into `logic/`. Do not copy `innerHTML`, `getElementById`, or `window.Scheduler`.

## Already the same

These pairs match on scheduling logic. Do not re-port them. Rebirth-only gender handling is called out where it must stay.

| Alpha | Rebirth | Note |
| --- | --- | --- |
| `modules/bid-planner/js/ebid.js` | `modules/ship/ebid.js` | 45-column builder, CSV, JSON fallback, QA |
| `modules/shared/utils/time.js` | `modules/build/shifts/time.js` | |
| `modules/shared/utils/dates.js` | `modules/build/period/dates.js` | Luxon is optional. Do not add it back |
| `modules/setup-panel/utils/slots.js` | `modules/build/shifts/slots.js` | `operatingSlots`, `refineBalance` |
| `modules/function-coverage/lib/pools.js` | same path under `modules/build/` | |
| `modules/function-coverage/lib/shifts.js` | same | |
| `modules/function-coverage/lib/migrate.js` | same | exact start+end band match only |
| `modules/setup-panel/utils/certs.js` | `modules/build/certs/certs.js` | DOM readers are dead. Do not revive them |
| `modules/setup-panel/utils/parityReport.js` | `modules/build/actions/parityReport.js` | Rebirth also skips the check when the class ignores gender. Keep that |
| `modules/review/lines` weekday map | `lines-table/row-model.js` idea | Sun–Sat columns map through `weekdaySun0(addDays(start, offset))`, not `dayIndex % 7` |
| Coverage dash / opsFte gate | `modules/review/coverage/counts.js` | A `-` duty or `function === "-"` is out. Training is out. Non-ops extras are out unless that day's duty is BAG, DFO, or PAX |

## Math that must change

Port these before any new screen. Acceptance tests already live in Alpha `tests/`. Run the logic tests. Do not snapshot HTML.

### 1. Generate order

Alpha `modules/setup-panel/actions/generate.js` (about lines 152–172). Rebirth still does TSO, then LTSO, then STSO, and never passes partners.

Alpha order:

1. STSO headcount with `allocateSupervisoryHeadcounts(..., "stsoForce", [])`. The empty array is intentional. Free STSO seats are not weighted by TSO lines.
2. LTSO headcount with `partnerLines = locked STSO + new STSO`. Free LTSO seats follow the STSO shift counts when any partner shift overlaps.
3. LTSO lines with `buildSupervisoryLines(counts, "LTSO", { partners })`.
4. TSO lines last, so the hour grid can balance TSO RDOs without moving leadership.

`classGenerate.js` must use the same partner argument when the class is LTSO. Alpha filters partners with `isStso || empClass === "STSO" || position === "STSO"`.

### 2. RDO model

Rebirth still copies `rdoHard` and pads Sunday-first, or calls `consecutiveRdos(seed)`. Alpha replaced that.

Shift fields `normalizeShift` must keep:

| Field | Rule |
| --- | --- |
| `rdoHard` | Sun=0…Sat=6. If `rdoBlock` is set, `rdoHard` becomes a copy of `rdoPins` |
| `rdoMode` | `"off"` (default), `"4x10"`, `"5x8"`. Aliases: pair/consecutive → 4x10; adjacent/adj → 5x8 |
| `rdoConstraint` | One weekday 0–6, or null |
| `rdoBlock` | 2, 3, or 4, or null |
| `rdoPins` | Weekdays that are always off. `rdoPin` (singular) still imports as a one-element list |
| `rdoPinRequired` | Boolean |
| `segments` | Two spans, second starts after the first ends. Time only. RDO placement does not read segments |
| `dayTimes[dow]` | Per-weekday start/end or two segments |
| `force`, `ltsoForce`, `stsoForce` | Non-negative integers |
| `phase` | `auto`, `opening`, `am`, `pm`, `closing` |
| `crewGroupId` | String or empty |

Source, in this order:

- `modules/setup-panel/utils/rdoBlock.js` — `normalizeRdoBlock`, `normalizeRdoPins`, `assignBlockRdos`, `placedRdosOk`, `lockedRdoNotes`
- `modules/setup-panel/utils/shiftMath.js` — `normalizeRdoMode`, `normalizeConstraintDay`, `rdoModeActive`, `assignRdoDays`, `legacyRdoDays`

`assignRdoDays(S, shift, rdoCount, seed, opts)`:

- Seed is a non-negative integer. Bad seed becomes 0.
- If the shift has a block size, `assignBlockRdos`. Otherwise `legacyRdoDays`.
- Block 2–4: consecutive window, then the pin if it is not already in the window. Flex fills only what is still short.
- 4×10 pin is not glued to the block. Tue + Fri–Sat is legal.
- 5×8 pin sits inside the two-day block.
- `opts.avoidDays`: non-pin days must miss those days. Omit it for the legacy pick. STSO uses this. LTSO does not.
- `placedRdosOk` is false when `ok === false` or `rdoDays` is empty. Callers must not copy a rejected placement. Alpha notes the reject once per shift (`noteRejectedRdos`).

`legacyRdoDays`: hard days win, then pad to the count, else `consecutiveRdos(count, seed)`.

Every line builder must call `assignRdoDays`. Today only Alpha does, in:

- `buildLines.js` (TSO and supervisory)
- `classGenerate.js` `createLineForClass`
- `extraPositions.js` `rdoDaysFor`
- `trainingClasses.js` `rdoDaysFor`
- `shiftsTable.js` preview

Rebirth `extraPositions.js` and `trainingClasses.js` still have the old `rdoDaysFor`. Replace them. Do not keep both.

### 3. TSO line build

Alpha `buildLines.js` after the person is taken from the pool:

- Work days come from `targetWorkDays(shiftId, empClass)`. PT uses `ptDaysPerWeek` (default 3, clamp 1–6). Paid ≥ 10 hours → 4 work days. Else 5.
- RDO count is `7 - workDays`.
- If an hour grid can be built, `pickBalancedRdos` tries seed, seed+1, … seed+6. Lowest score wins. Seed wins a tie.
- Score is the max−min of 30-minute on-duty counts for slots that shift covers, open to close, step 30. Paint, measure, unpaint.
- No grid (missing open/close, or nothing covers): one `assignRdoDays` at `slot.rdoSeed`.
- A rejected placement drops that seat and pushes one issue. It does not emit a line.
- 4×10 seats take FT only. PT is preferred on non-long seats until the PT quota is filled. That part already exists in rebirth. Keep it.

Hour grid needs `shiftCoversSlot(shiftId, slotStart, dow)`. Split segments count. A shift covers the slot when any segment contains it. Overnight (`end <= start`) wraps.

### 4. Supervisory line build

`buildSupervisoryLines(S, counts, supType, opts)`.

`opts.partners` is the STSO lines already placed. Used only for LTSO.

Pass 1, sex, still from M/F pools, with this extra rule for LTSO: on that shift, prefer the sex opposite the STSO majority. Track how many LTSO of each sex were already placed on that shift so the second LTSO can flip. This does not place calendar days.

Pass 2, RDO, females first. Score for each of the seven seeds:

```
gaps * 1000 + dutySpread * 10 + pairReuse
```

- `gaps`: female line only. Count of non-pin weekdays where no female STSO/LTSO partner is on duty and this candidate is also off. The pin may stay empty.
- `dutySpread`: max−min of this class's on-duty counts after adding the candidate.
- `pairReuse`: how many lines already hold this pair key. Key is the non-pin RDO days. If there is no extra day, the key is the full RDO set.
- STSO with pins: pass `avoidDays` = days already taken by earlier STSO lines in this build. LTSO does not. STSO pin blocks still share only the pin.
- Partner RDOs preload `pairUse` and `femaleOn`.
- Rejected placement stores no `rdoDays` and emits no line.
- Ids: STSO from 10000, LTSO from 20000. `lineCode` is `STSO 01` / `LTSO 01`. Flags: `isStso` / `isLtso`, `empClass` and `position` set to the type.

`allocateSupervisoryHeadcounts(..., tsoLines, partnerLines)`:

- Forced `stsoForce` / `ltsoForce` still scale down when the force sum exceeds the pool.
- Free seats: if `partnerLines` hit any free shift, weight by partner count on that shift (0 is allowed, so a shift with no STSO gets no free LTSO).
- Else if TSO lines exist on a shift, weight by that count.
- Else weight by how many open-close slots the shift covers.

Alpha full generate passes `[]` as `tsoLines` for both STSO and LTSO. Partners carry the LTSO weights. Do not "fix" that back to TSO weights.

### 5. Locks

`modules/setup-panel/utils/scheduleLocks.js`. Rebirth calls `isLineScheduleLocked` and never defines it, so locks never stick.

- `state.scheduleLocks[]`: `{ classKey, sex, shiftId }`. `"ALL"` or blank means unconstrained on that axis.
- A line is locked when any rule matches.
- Generate keeps locked lines, subtracts them from headcount, refreshes shift name/label/times from the current shift, and does not rebuild their schedule.
- `lockedRdoNotes`: if the shift now has a block and a locked line is missing a pin, push an issue. Do not rewrite the locked RDOs.
- Class generate, parity, DFO cert moves, FT/PT rebalance, DFO rebalance, and sex swap all skip locked lines.
- Class key match uses `getLinesForClass` from `rebalanceFt.js` (`TSO_FT`, `TSO_PT`, `TSO_ALL`, `STSO`, `LTSO`, extras, training). That is a different key set from the modal's `TSO` / `EXTRA_<id>`. Do not merge them.

### 6. Class generate must rerun duty assignment

Alpha `classGenerate.js` after schedules are written:

```
generateFunctionAssignments({ fromGenerate: true })
assignCertPools()
```

Rebirth paints a local rotation instead: shortfall → `-`, training → `TRAINING`, everyone else → existing function or `PAX`. That skips certified pools, shift requirements, and baggage rotation for the new class, and it can leave stale duties on everyone else.

Replace that local paint with the two calls. Keep shortfall `certPool = "A"` and `functionEligible` cleared before the assign call. Alpha `certAssign.js` also bails out of pool assignment when `isShortfall` or `function === "-"`. Rebirth removed that bail. Put it back so a later `assignCertPools()` cannot move a dash line into pool B.

### 7. Duty and certified pools

`function-coverage/lib/duty.js` `lineCoversSlot`:

- Map `dayIndex` to weekday with `weekdaySun0(addDays(startDate, dayIndex))`.
- Prefer `shiftCoversSlot(shiftId, slotMin, dow)`.
- Fallback must walk `getEffectiveShiftSegments` (both halves of a split), not `getEffectiveShiftTimes` alone. Rebirth uses the single span, so a split shift covers the gap.
- Overnight segment: cover if `slotMin >= start || slotMin < end`.

`getRotationDuty`: Alpha returns the line function when it is `BAG`, `DFO`, `PAX`, or `-`. Rebirth dropped `-`. A dash line with an empty rotation cell then looks like PAX. Restore `-`.

`certifiedPools.js` and `assign.js` `unused` / the pool wipe:

- Skip `isExtra`, `extraPositionId`, `isShortfall`, and `function === "-"`.
- Rebirth only skips extras, then uses `positionMatchesSex`.
- Keep `positionMatchesSex` so ignore-gender and `dropM` / `dropF` still work. Add the shortfall and dash exclusions on top. Do not go back to `l.sex === sex` only, or dropped lines re-enter the cert pools.
- `fillPtReserveBySwap` in Alpha requires `l.sex === sex` on the FT DFO donor. Rebirth allows a blank sex. Keep the blank-sex allowance only when `positionMatchesSex` is true. Do not swap a dash or shortfall line.

`function-coverage/lib/coverage.js` (`countAssignedAtSlot`, `computeAssignedCoverage`) is not in rebirth. Coverage's 30-minute matrix should call the same `lineCoversSlot`. Do not fork a third slot test.

### 8. What rebirth added and must not lose

- `fte/gender.js`: per position `ignoreGender`, `dropM`, `dropF` for FT, PT, LTSO, STSO, and each extra. Ignore means the line has no counted sex. Drop still builds the line and clears `countSex`.
- Parity skipped when the class ignores gender.
- DFO same-sex moves use an explicit `M` or `F`. Alpha treats a missing sex as `M` (`sex || "M"`). Do not port that default.
- `setupStore` is a write-only mirror. Session state is the source.
- Present is a snapshot. Teams move with a select. Neither is a placeholder for the Alpha screen of the same name.

## Engines Alpha has and rebirth does not

Port as `logic/` with no DOM. The Alpha file is the spec. The view is new Svelte.

| Alpha file | Lines | What it decides | Rebirth |
| --- | --- | --- | --- |
| `utils/rebalanceFt.js` | 302 | Band-delta planner for `TSO_FT`, `TSO_PT`, `TSO_ALL`, STSO, LTSO. Also `getLinesForClass` | Missing |
| `utils/rebalancePt.js` | 127 | PT-specific rebalance. Skips locks | Missing |
| `utils/rebalanceDfo.js` | 281 | Move DFO-eligible people between bands. Not the cert-balance tool. Skips extras, training, bag-blocked | Missing. `dfoCertBalance.js` is the other tool and is already ported |
| `utils/swapSex.js` | 253 | 1:1 M↔F seat swap across two or more shifts. Uses `getLinesForClass` | Missing |
| `utils/scheduleLocks.js` | short | See §5 | Called, not defined |
| `coverage/utils/hourly.js` | ~100 | 30-minute matrix, sex counts, role toggles, func view `all` / `dfo` / `bag` / `pax` | `counts.js` is a partial port. No cut list |
| `coverage/components/cuts.js` | 215 | Propose shift cuts and write them onto lines | Missing |
| `reports/deviation.js` | 261 | Role × weekday matrix, compress empty rows | Missing |
| `reports/gender-balance.js` | 214 | Phase anchors, opening/AM/PM/close sex balance | Missing |
| `reports/capacity-math.js` + `capacity-render.js` | | Daily capacity | Missing |
| `reports/mod-set-day.js` | 148 | Mod-set per team per day, `balanceDayPairings`, `assignCoverageByDay` | Missing |
| `reports/cohesion.js` | 160 | Supervisor overlap hours per team | Missing |
| `demand-capacity/parse.js` | 181 | Flight sheet: DOW, ETD, seats, rate, pct orig, load factor | Missing |
| `demand-capacity/aggregate.js` | 118 | ETD → land minute, arrival curve, 30-minute buckets | Missing |
| `demand-capacity/staffing.js` | 117 | Staff on PAX duty vs demand slots. `dowToScheduleOffset` | Missing |
| `team-builder/utils/autoForm.js` | | RDO overlap, exact RDO, start window, sex score, role score, renumber by start | `modules/teams/form.js` is a shorter cousin. Diff it against Alpha before replacing. Do not assume they match |
| `team-builder/utils/pool.js`, `team.js`, `phase.js`, `extraTeams.js` | | Pool filters, AM/PM, extra-type teams | Missing as named units |
| `bid-planner/js/scheduler.js` | 235 | Forward from announcement, backward from execution, business-day adjust | Missing. Plan in rebirth is a static rail |
| `bid-planner/js/calendar.js`, `rules.js`, `conflicts.js`, `validation.js` | | Weekend, holiday, blackout, rule schema, conflict list | Missing. Config is `modules/bid-planner/config/calendar.json` and `rules.json` |
| `bid-planner/js/miles/*` | | Portfolio, milestone offsets, ICS, month grid. Commit `e44a6a9` replaced the miles view with BIDPLANNER. Read `panel.html` and `index.js` before porting miles. Do not build both UIs | Missing |
| `shared/lines/excel.js` + `exportStyle.js` | | ExcelJS line workbook | Missing. Vendor `lib/exceljs.min.js` local. No CDN |
| `js/io.js` | | JSON envelope | `sessionIo.js` already round-trips lines, schedule, teams, setup. Extend it for `scheduleLocks`, RDO fields, and mod-set day map. Do not add a second importer |

Not math, do not block the engine on these: intro (`js/intro.js`), instructions modal, console airport/operator chrome, Tauri `get_operator` / `writeSharedFile`. Core can grow those after the modules calculate.

`function-coverage/lib/bands.js` and `extras.js` are DOM. The form already writes `state.functionCoverage` and `state.extraPositions`. Do not port `readFunctionBandsFromDom` or `extraCardsHtml`.

`setup-panel/actions/render.js` (892), `shiftsTable.js` (808), `generateModal.js` (700), `paint.js`, `bridge.js` are DOM. Mine them for fields and button names only.

## Target tree

Core renders. Modules calculate. OneDrive holds source and the compiled `dist/` other machines sync. No module reaches into another module's source. Shared math is its own module, loaded first, and attached onto the session the way Alpha attaches onto `Scheduler`.

```
blade/
├── tauri-core-app/
│   ├── index.html                      # import map for svelte/internal only. No CDN
│   ├── src-tauri/                      # file protocol for the OneDrive dist folder
│   └── src/
│       ├── main.js
│       ├── App.svelte                  # boots shell, asks loader to scan
│       └── core/
│           ├── components/
│           │   ├── AppShell.svelte     # mast, stage tabs, slot. No generate math
│           │   └── ModuleRenderer.svelte
│           └── services/
│               ├── eventBus.js         # replaces window CustomEvents and sessionBus
│               ├── moduleLoader.js     # reads dist/<id>/manifest.json + index.js
│               └── registry.js         # reject a module whose manifest fails the contract
│
└── onedrive-shared-modules/
    ├── package.json                    # vite, svelte. Dev only
    ├── build.js                        # one programmatic Vite build per module → dist/<id>/
    ├── src/
    │   ├── shared/
    │   ├── plan/
    │   ├── build/
    │   ├── lines/
    │   ├── coverage/
    │   ├── reports/
    │   ├── demand/
    │   ├── ship/
    │   ├── present/
    │   └── teams/
    └── dist/
        └── <id>/
            ├── manifest.json
            ├── index.js
            └── styles/index.css
```

Each module:

```
src/<id>/
├── manifest.json
├── views/          # Svelte. Markup and local state only
├── logic/          # Pure. No document, no window, no Svelte
└── actions/        # Thin. Clicks call logic, then bus.emit("session:lines")
```

`manifest.json` contract:

```json
{
  "id": "build",
  "label": "Build",
  "order": 2,
  "slots": ["stage"],
  "init": "initBuild",
  "subs": []
}
```

`registry.js` rejects a module when `id` is missing, `init` is not a function, a slot is unknown, or `index.js` throws on import. A bad module does not take down the shell.

`eventBus.js` events, and no others:

| Event | When |
| --- | --- |
| `session:lines` | Lines, schedule, rotation, or teams changed |
| `session:setup` | Period, FTE, shifts, coverage, certs changed |
| `nav:stage` | Shell changed stage. Payload `{ id, sub }` |

Kill `lines:request-render`, `setup:mounted`, `blade-intro-done` once nothing listens. They are reserved in rebirth and unused.

Session object stays one. Core creates it. `initX(session, bus)` may attach methods. Modules do not construct a second store. `setupStore` goes away. Gender policy stays on `session.state.positionGender`.

Import map in core `index.html` points `svelte` at the local package the core was built with. Module `dist/index.js` must be built against that same Svelte major. Do not load a second Svelte from OneDrive.

Vendored browser libs, if a module still needs them, live under `onedrive-shared-modules/vendor/` and are copied into that module's `dist/`. Allowed: `exceljs`, `sortable`. Not allowed: luxon, dayjs, a CDN script. Dates stay in `shared/logic/dates.js`.

### File budget

A `logic/` file stays under 220 lines. A `views/` file stays under 250 lines of script plus markup. Style goes to the extracted CSS. If a port source is bigger, split on the seams below. Do not ship the Alpha file whole.

| Alpha source | Split into |
| --- | --- |
| `buildLines.js` (640) | `logic/tsoLines.js`, `logic/supervisoryLines.js`, `logic/rdoScore.js` (`pickBalancedRdos`, `hourGrid`, `dutySpread`, `femaleGapCount`, `pairKeyOf`) |
| `rdoBlock.js` (324) | `logic/rdoBlock.js` (normalize + windows), `logic/rdoAssign.js` (`assignBlockRdos`, `placedRdosOk`, `lockedRdoNotes`) |
| `shiftMath.js` (315) | `logic/shiftClock.js` (segments, covers, overlap), `logic/rdoDays.js` (`assignRdoDays`, counts, normalize) |
| `classGenerate.js` (454) | `logic/classGenerate.js` (orchestrator), `logic/classLine.js` (`createLineForClass`, `placeOpen`) |
| `generateModal.js` (700) | views: `Targets.svelte`, `Parity.svelte`, `DfoCert.svelte`. Logic already wants to be three files |
| `rebalanceFt.js` (302) | `logic/classMatch.js` (`getLinesForClass`), `logic/rebalanceFt.js` |
| `shiftsTable.js` / `render.js` | do not port. Views: `ShiftList.svelte`, `ShiftDayTimes.svelte`, `RdoConstraint.svelte` |
| `ebid.js` (853) | `logic/ebidColumns.js`, `ebidTime.js`, `ebidRow.js`, `ebidCsv.js`, `ebidQa.js` |
| `LinesTable.svelte` (663) | `views/LineFilters.svelte`, `views/LineTable.svelte`, `views/LineDayCell.svelte`. Row math stays `logic/rows.js` |
| `autoForm.js` + team components | `logic/autoForm.js`, `logic/pool.js`, `logic/teamScore.js`. Views: `TeamBoard.svelte`, `Unassigned.svelte`, `AutoForm.svelte` |
| `deviation.js`, `gender-balance.js` | one logic file each, one view each |
| `demand` parse / aggregate / staffing | three logic files. One view |

`generate.js` stays the coordinator and stays under 220. It may only call the functions above.

### Where each behavior sits

| Module | Logic | Views | Actions |
| --- | --- | --- | --- |
| `shared` | `time.js`, `dates.js`, `session.js` (`createEmptySession`, attach order), `gender.js`, `ids.js` | none | none |
| `build` | RDO, shift clock, headcounts, TSO lines, supervisory lines, extras, training, schedule-for-line, generate, class generate, validate, locks, certs, function assign / pools / duty, parity, DFO cert, rebalance FT/PT/DFO, sex swap, session JSON | `BuildForm.svelte` composed of the small views in the budget table, plus `GenerateModal.svelte` | `commitSetup.js`, `runGenerate.js`, `io.js` |
| `lines` | `rows.js` (weekday map), `edit.js` (duty, day time, inline field) | filters, table, day cell | `applyEdit.js` writes session then `session:lines` |
| `coverage` | `hourly.js`, `cuts.js` | matrix, cut list | `applyCuts.js` |
| `reports` | deviation, gender balance, capacity, mod-set day, cohesion, print model | one svelte per report | `setModSet.js` |
| `demand` | `parse.js`, `aggregate.js`, `staffing.js` | chart view. Canvas or SVG, no chart library unless it is vendored | `loadSheet.js` reads a local file |
| `ship` | eBid files | form, preview, QA | `downloadCsv.js`. Fallback import must not write the session |
| `present` | none beyond reading state | snapshot figures | none |
| `teams` | autoForm, pool, score, extra-type teams | boards, unassigned, auto-form form | `moveMember.js`. Drag-and-drop is allowed here only, via vendored Sortable, and it must call the same `moveMember` the buttons call |
| `plan` | calendar, rules, conflicts, scheduler, milestone math | timeline, rule list | `savePlan.js` in `localStorage`, not in the line session |

Function coverage is not a stage. It is `build/logic/function/*.js` because generate calls it in-process. Coverage and reports call `session.lineCoversSlot` and `session.getRotationDuty`. They do not import build source.

### Attach order inside `shared/logic/session.js`

1. Defaults (hours, FTE, five shifts, cert pool, empty locks, empty lines).
2. Shift clock + RDO assign.
3. Locks.
4. Headcounts, TSO lines, supervisory lines.
5. Training, extras.
6. Cert pools.
7. Function coverage (duty, pools, assign, `resolveBagDuties`).
8. Generate, class generate.
9. Parity, DFO cert, rebalance, sex swap.

`opsFteYes`, `lineInOpsCoverage`, `buildExtraPositionLines` stay. `attachExtraPositions` does not.

## Build order for the next implementation pass

Do not start at the shell.

1. Move the current rebirth engine into `onedrive-shared-modules/src/build/logic/` without behavior changes. Get `npm run check` green. This is a move, not a port.
2. Replace RDO placement (§2) and point TSO, supervisory, class, extra, and training at `assignRdoDays`.
3. Flip generate and class-generate order (§1, §4). Pass partners.
4. Restore `lineCoversSlot` segments, dash in `getRotationDuty`, shortfall/dash exclusions, class-generate `generateFunctionAssignments` (§6, §7).
5. Attach `isLineScheduleLocked` (§5).
6. Port Alpha tests that touch those functions: `test-rdo-modes.mjs`, `test-crew-groups-rdo-sex.mjs`, `test-split-shift.mjs`, `test-schedule-locks.mjs`, `test-function-coverage.mjs`, `test-resolve-bag.mjs`, `test-dash-duty-coverage.mjs`, `test-generate-modal.mjs`, `test-dfo-rebalance.mjs`.
7. Split any file that crossed 220 lines while doing 2–5.
8. Only then add rebalance, sex swap, coverage cuts, reports, demand, and plan.
9. Core loader last. Until it exists, Vite may still mount the modules from source so the math can be checked.

## Out of scope for that pass

- Rewriting rebirth screens that already match Alpha numbers (eBid, parity, basic coverage dash rules, line weekday columns).
- Porting Alpha DOM renderers.
- Drag-and-drop on any stage except Teams.
- A second Svelte, a CDN, or Luxon.
- Treating `setupStore` as a reader.
