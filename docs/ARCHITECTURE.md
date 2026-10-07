# Architecture

Map of blade-rebirth on `main` (`59e1c79`). If this file and the tree disagree, the tree wins. Update this file in the same change.

Alpha is the behavior reference. This repo is the rewrite. Do not port Alpha files in wholesale.

## Runtime

Offline SPA. Svelte 5 + Vite. No server, no database, no CDN script. The page is `index.html` → `src/main.ts` → `App.svelte` on `#app`.

Hash is the router. `src/lib/tabs.ts` reads `modules/manifest.json` and eager-loads every `modules/**/*.svelte` with `import.meta.glob`. A stage renders only if its `entry` path matches a loaded component. Unknown hash `#setup` opens Build. `#lines`, `#coverage`, and `#reports` open those Review subs.

| Hash | Stage | Panel |
| --- | --- | --- |
| `#plan` | Plan | `modules/plan/PlanPanel.svelte` |
| `#build` | Build | `modules/build/BuildPanel.svelte` |
| `#review/lines` | Review | `modules/review/lines/LinesPanel.svelte` |
| `#review/coverage` | Review | `modules/review/coverage/CoveragePanel.svelte` |
| `#review/reports` | Review | `modules/review/reports/ReportsPanel.svelte` |
| `#ship` | Ship | `modules/ship/ShipPanel.svelte` |
| `#present` | Present | `modules/present/PresentPanel.svelte` |
| `#teams` | Teams | `modules/teams/TeamsPanel.svelte` |

F1–F6 follow manifest order (Plan through Teams). The mast paints a number on the first five tabs only. Teams is still F6. Arrow keys move the focused tab. Escape is left to the generate modal. Theme is `localStorage["blade.theme"]`: `dark` (default) or `presentation`. Tokens live in `src/app.css`.

## One session

`modules/build/session.ts` exports `session`, built by `createEmptySession()`. Build, Review, Ship, Present, and Teams import that object. Plan does not. It is a mutable bag, not a Svelte store. Panels that must redraw subscribe with `onSessionLines` and bump a local `tick`. Build also writes through an `$effect`.

`SetupSession` / `SetupState` in `types.ts` cover the methods the modal calls and a slice of line fields. They do **not** cover hours, FTE, certs, function coverage, teams, or most attached methods. JS modules are `@ts-nocheck`. Panels cast. Treat `defaultSetupState()` plus the attach list below as the real contract until the types catch up.

### Attach order

`createEmptySession` then:

1. `attachSetupState` — fill missing state from `defaultSetupState()`, default shifts, cert pool, `shiftSeq`
2. `attachShiftMath` — shift lookup, segments, RDO counts, `getBandKey`, `normalizeShift`
3. `attachAllocation` — headcount, `buildLines`, `buildSupervisoryLines`, legacy cert DOM readers
4. `attachTrainingClasses` — ESTI / MSTI line build and `formTrainingTeams`
5. `attachCertPools` — pool normalize, `assignCertPools`, legacy DOM fill
6. `attachFunctionCoverage` — duty, pools, shift requirements, assign, `resolveBagDuties`
7. `opsFteYes`, `lineInOpsCoverage`, `buildExtraPositionLines` (not `attachExtraPositions`)
8. `attachGenerate` — `generate`, `buildScheduleForLine`
9. `attachClassGenerate` — `generateClass`, `belongsToClass`, `getClassHeadcount`
10. `attachParityReport` — `checkParity`, `approveParitySwaps`
11. `attachDfoCertBalance` — `proposeDfoCertBalance`, `approveDfoCertBalance`

`session.teams = { teams: [] }` is set before the attaches. It is not on `state`.

### `setupStore` is a write-only mirror

`stores/setupStore.js` exports defaults (`defaultShifts`, `defaultFunctionCoverage`, `defaultSetupState`) and a plain object `{ fte, period, extraPositions, functionCoverage }`. Build `commit()` and `sessionIo.mirrorStore()` copy slices onto it. Nothing reads those fields back. Session state is the source. Do not add a third copy.

### State keys that exist

From `defaultSetupState()`, plus fields generate and import write:

`open`, `close`, `useDynamicHours`, `dayHours`, `startDate`, `weekCount`, `generateSeed`, `activeSeed`, `ftM`, `ftF`, `ptM`, `ptF`, `ptHoursPerDay`, `ptDaysPerWeek`, `ltsoM`, `ltsoF`, `stsoM`, `stsoF`, `esti`, `msti`, `positionGender`, `certDfoMax`, `certPaxMax`, `certBagMax`, `certDfoEnabled`, `certBagEnabled`, `certPool`, `functionRotation`, `functionCoverage`, `shifts`, `shiftCrewGroups`, `scheduleLocks`, `lines`, `schedule`, `extraPositions`, `issues`, `mode`.

`functionCoverage` shape: `mode`, sexed DFO/BAG pool counts, rolled-up `poolStsoDfo` / `poolLtsoDfo` / `poolTsoDfo` / `poolBag`, `amPmSplit`, `phaseThresholdMin`, `bias`, `requirements.{STSO,LTSO,TSO}[shiftId] = {min,max}`, `requirementShiftIds`. `migrate.js` maps legacy `{start,end,stsoMin,...}` bands onto shifts only on an exact time match.

A line is a free object. Fields the code actually reads include `id`, `lineCode`, `shiftId`, `shiftName`, `empClass`, `position`, `isLtso`, `isStso`, `isExtra`, `extraPositionId`, `extraName`, `opsFte`, `sex`, `function` (`DFO` `PAX` `BAG` `TRAINING` `-` or empty), `functionEligible`, `certPool`, `rdoDays`, `rdoHard`, `paid`, `isShortfall`, `isTraining`, `trainingClass`, `countSex`.

`schedule[lineId]` is `WORK` / `RDO` per day. `functionRotation[lineId]` is the duty per day.

## Generate

`GenerateModal` calls `session.generate()` or `session.generateClass(classKey, targets)`.

`generate` (`actions/generate.js`):

1. Optional Alpha hooks if present: `collectSetupInputs`, `readShiftsFromDom`, `readExtraPositionsFromDom`. Rebirth does not attach the first two. `readExtraPositionsFromDom` exists only after `attachExtraPositions`, which `session.ts` does not call. The form already wrote `state`.
2. Resolve `activeSeed` (`random` → `Math.random`, else parsed int, else 42).
3. `validateGenerateInputs` — at least one shift, some FT/PT or extras or training, close after open. Hard-RDO mismatches are notes, not failures. Zero headcount clears lines and stops.
4. Partition lines where `isLineScheduleLocked` is true into TSO / LTSO / STSO / other. That method is not attached, so every locked list is empty.
5. If FT+PT > 0: `allocateShiftHeadcounts` + `buildLines`. Otherwise `state.mode` stays `"extras"` and no TSO lines are built.
6. LTSO and STSO: `allocateSupervisoryHeadcounts` + `buildSupervisoryLines`, headcount reduced by locked counts (zero today).
7. `buildExtraPositionLines`, then `buildTrainingClassLines`.
8. Replace `state.lines` with locked TSO, new TSO, locked LTSO, new LTSO, locked STSO, new STSO, locked other, extras, training. Then `applyPositionGender`.
9. `buildScheduleForLine` for every line (`weekCount * 7` days).
10. `generateFunctionAssignments({ fromGenerate: true })` always. It clears functions, builds certified pools, applies shift requirements, fills `functionRotation`. It does not look at a skip flag in `generate.js`. `getFunctionMode()` is only for the status string.
11. `assignCertPools`.
12. `formExtraTeams`, which also calls `formTrainingTeams` when that method is attached (it is).
13. Day-of-week TSO spread note when max−min exceeds `max(2, ceil(ft+pt * 0.15))`.
14. Optional Alpha refresh (`renderAll`, `renderCoverageBars`, `renderLines`, `renderTeams`, `lines:request-render`). None of those are attached.
15. `notifySessionLines()`.

`generateClass` replaces one class and leaves the others. Class keys are `STSO`, `LTSO`, `TSO` (FT and PT together), `MSTI`, `ESTI`, or `EXTRA_<id>`. It still builds a schedule and cert-assigns that class.

Parity and DFO cert balance are modal actions, not part of generate. Both return proposals; approve writes RDOs or function tags and returns `boolean`.

## Who reads the session

| Surface | Reads | Writes |
| --- | --- | --- |
| Plan | nothing | nothing |
| Build | form mirrors state on mount | `$effect` → `state` and the `setupStore` mirror. Generate, import, export, clear, baggage resolve |
| Lines | `rowsFromSession` | inline edit (`edit.js`): duty, day time, line fields |
| Coverage | `counts.js` hourly / duty / mix / position | nothing |
| Reports | counts and shortfalls off `state` | nothing |
| Ship | `ebid.js` `rowsFromScheduler(session)` | download CSV. Fallback JSON/CSV import does **not** replace live lines |
| Present | snapshot of period, hours, FTE, line sex counts | nothing |
| Teams | `teams/form.js` `collectPool` | `autoFormTeams` / `writeTeams`. Move is a `<select>`, not drag-and-drop |

`sessionBus` is the only refresh channel. `modules/shared/lib/events.ts` reserves Alpha names (`lines:request-render`, `setup:mounted`, `blade-intro-done`, …). Nothing listens. `main.ts` re-exports the list.

## Module graph

Arrows are static imports. Attach calls are listed under the session, not repeated here.

### Shell

```
index.html
  src/main.ts
    src/app.css          @fontsource/ibm-plex-mono (latin 400, 500)
    src/App.svelte
      src/lib/tabs.ts    modules/manifest.json + glob of modules/**/*.svelte
      src/lib/theme.ts
    modules/shared/lib/events.ts   (re-export only)
```

### Build engine

```
BuildPanel.svelte
  GenerateModal.svelte
    generateModal.ts          types.ts
  session.ts                  types.ts
  sessionBus.js
  sessionIo.js                sessionBus, setupStore, gender, certs, shifts/time, period/dates
  setupStore.js               gender.js
  period/dates.js
  fte/gender.js

session.ts
  actions/generate.js         schedule, formExtraTeams, validate, sessionBus, gender
  actions/allocation.js       shifts/slots, fte/headcounts, fte/buildLines, certs
  actions/classGenerate.js    schedule, certs/certAssign, gender
  actions/parityReport.js     fte/buildLines (getBandKey), gender, sessionBus
  actions/dfoCertBalance.js   sessionBus
  function-coverage/attach.js period/dates, lib/duty, lib/pools, lib/shifts, lib/assign
  stores/setupStore.js
  certs/certs.js              certAssign.js, certsLegacy.js
  fte/trainingClasses.js      fte/buildLines (getBandKey, createPRNG)
  fte/extraPositions.js       fte/buildLines (getBandKey, createPRNG, seededShuffle)
  shifts/shiftMath.js
  shifts/time.js

function-coverage/lib/pools.js    lib/shifts, lib/migrate, lib/certifiedPools
function-coverage/lib/assign.js   lib/duty, lib/pools, lib/shifts, fte/gender, sessionBus
function-coverage/lib/certifiedPools.js   lib/shifts, fte/gender
function-coverage/lib/migrate.js  lib/shifts
function-coverage/lib/duty.js     (no file imports; binds the session)
function-coverage/lib/shifts.js   lib/duty

fte/headcounts.js             shifts/slots
fte/buildLines.js             fte/gender
schedule/buildScheduleForLine.js   period/dates
```

`generateModal.ts` does not import the JS engine. It calls methods on the session object (`generate`, `generateClass`, `checkParity`, `approveParitySwaps`, `proposeDfoCertBalance`, `approveDfoCertBalance`) and reimplements `getBandKey`, `getBandLabel`, and `formatRdos`.

### Review, Ship, Present, Teams

```
ReviewPanel.svelte
  lines/LinesPanel.svelte     session, sessionBus, lines/edit.js, lines/rows.js
  coverage/CoveragePanel.svelte   session, sessionBus, coverage/counts.js
  reports/ReportsPanel.svelte session, sessionBus

ShipPanel.svelte              session, sessionBus, ship/ebid.js
PresentPanel.svelte           session, sessionBus
TeamsPanel.svelte             session, sessionBus, teams/form.js
```

`teams/form.js` and `build/teams/formExtraTeams.js` both write `session.teams` and do not import each other. Generate's extra teams can be replaced by Teams → Auto-form.

`counts.js`, `rows.js`, `edit.js`, `ebid.js`, and `form.js` do not import each other.

## npm

Direct packages only. Lockfile versions on `59e1c79`. No other runtime libraries (no dayjs, no luxon, no sortable).

| Package | Role | Lock |
| --- | --- | --- |
| `@fontsource/ibm-plex-mono` | Bundled font. Only `dependencies` entry | 5.3.0 |
| `svelte` | UI, runes | 5.57.1 |
| `@sveltejs/vite-plugin-svelte` | Vite plugin | 7.3.1 |
| `vite` | Dev / build. Rolldown bundler | 8.3.2 |
| `typescript` | `npm run check` | 6.0.3 |
| `svelte-check` | `npm run check` | 4.7.6 |
| `@tsconfig/svelte` | `tsconfig.app.json` | 5.0.8 |
| `@types/node` | `tsconfig.node.json` | 24.19.1 |

Transitive (do not import from these): plugin uses `deepmerge`, `magic-string`, `obug`, `vitefu`. Vite uses `lightningcss`, `postcss`, `rolldown`, `picomatch`, `tinyglobby`. Svelte pulls `acorn`, `aria-query`, `axobject-query`, `clsx`, `devalue`, `esrap`, `esm-env`.

Scripts: `dev`, `build`, `preview`, `check` (`svelte-check` then `tsc -p tsconfig.node.json`). No test script. No test files.

GitHub Pages (`.github/workflows/pages.yml`): Node 22, `npm ci`, `GITHUB_PAGES=true npm run build`, deploy `dist`. `vite.config.ts` sets `base` to `/blade-rebirth/` when that env is set. Dev server binds `0.0.0.0` on `PORT` or 5173.

## Alpha leftovers (still in the tree, not on the Svelte path)

| Hook | Where | Why it is cold |
| --- | --- | --- |
| `attachExtraPositions` | `fte/extraPositions.js` | Never called. Builds HTML for `#extra-pos-list` |
| `readCertConfigFromDom`, `fillCertPoolForm`, `readCertPoolFromDom` | `certs/certsLegacy.js`, `certs.js` | Look up `#cfg-cert-*`. Build does not render those ids. Form writes `state.certPool` |
| `collectSetupInputs`, `readShiftsFromDom`, `renderAll`, `renderLines`, `updateStatus`, `renderCoverageBars` | called if present from generate / class generate / parity / DFO / assign | Not attached |
| `isLineScheduleLocked` | generate, class generate, parity, DFO | Not attached. Lock filter never trips |
| `__USE_SVELTE_LINES` + `lines:request-render` | end of `generate` | Flag unset. Bus is `notifySessionLines` |
| `ALPHA_EVENTS` | `events.ts` | Reserved. No listeners |

`certsLegacy.js` is still imported by `certs.js` and re-exported. `allocation.js` attaches `readCertConfigFromDom` / `assignCertifications`. Safe to call only because missing DOM nodes no-op. Do not add those ids back to "make the legacy path work."

## Duplicated helpers

| Name | Copies |
| --- | --- |
| `getBandKey` | `fte/buildLines.js`, `shifts/shiftMath.js`, `generateModal.ts` |
| `getBandLabel`, `formatRdos` | `actions/parityReport.js`, `generateModal.ts` |
| `weekdaySun0` / add-days | `period/dates.js`, `ship/ebid.js` (`addDaysIso`) |
| `timeToMin` | `shifts/time.js` (also on the session), local in `teams/form.js` |
| `isTrainingLine` | `fte/trainingClasses.js`, local in `ship/ebid.js` |

One implementation each. `generateModal.ts` and `ebid.js` should call the build copies.

## File size

Lines on `59e1c79`. Svelte counts are script / markup / style.

| Lines | File | Split? |
| --- | --- | --- |
| 1254 (447 / 544 / 249) | `BuildPanel.svelte` | Yes. One component owns period, hours, FTE, gender, shifts, extras, coverage, certs, import/export, and the result strip |
| 854 | `ship/ebid.js` | Yes. Columns, row build, CSV, JSON fallback, and QA are five jobs |
| 754 (103 / 388 / 251) | `GenerateModal.svelte` | Yes, the view. Logic is already in `generateModal.ts` |
| 652 (254 / 172 / 219) | `ShipPanel.svelte` | After `ebid.js`. Preview and QA can leave the panel |
| 523 | `generateModal.ts` | Yes, beside the modal sections. Stop growing it |
| 512 | `actions/classGenerate.js` | Yes. `placeOpen` + `createLineForClass` are half the file |
| 455 (98 / 190 / 162) | `LinesPanel.svelte` | No. Logic is in `rows.js` (174) and `edit.js` (209) |
| 445 | `fte/buildLines.js` | PRNG can leave. Line builders stay |
| 430 | `actions/parityReport.js` | `checkParity` is ~310 lines. Approve stays |
| 423 | `fte/extraPositions.js` | Drop the dead DOM half |
| 360 | `function-coverage/lib/assign.js` | Hold. Next split is day rotation, not a new folder |
| 329 | `function-coverage/lib/certifiedPools.js` | Hold |
| 309 | `src/app.css` | Hold. Shell tokens only; panels use scoped `<style>` |

Under ~250 lines is fine even if it does one job (`generate.js` is a coordinator at 194, `teams/form.js` at 213, `ReportsPanel` at 225).

Proposed cuts are in `RECOMMENDATIONS.md`. Do not split a file just to hit a number.

## Svelte 5

Panels use runes (`$state`, `$derived`, `$props`, `$effect`). No `svelte/store`. The repeated `tick` + `onSessionLines` subscription exists because `session` is an outside mutable. It is copied in Build, Lines, Coverage, Reports, Ship, Present, and Teams. A single revision counter next to `notifySessionLines` would delete that copy.

`BuildPanel` commits with `$effect`. That is why the form state and `session.state` can drift if a writer bypasses `commit` (generate and import do, then the panel hydrates). Keep one write path.
