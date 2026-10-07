# CLAUDE.md

Guidance for Claude Code when working on this repo. The map is [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Do not re-derive it from memory. If a change moves a module, update that file in the same commit.

## What this is

Rewrite of BLADE_Alpha. Offline airport bid-line scheduler (TSO / LTSO / STSO). Svelte 5 + Vite. One mutable session in `modules/build/session.ts`. Alpha is the behavior reference. Do not port Alpha wholesale.

## Commands

```bash
npm install
npm run dev       # Vite, port 5173 or $PORT
npm run build
npm run preview
npm run check     # svelte-check, then tsc -p tsconfig.node.json
```

No test script. Do not add a CDN script or a runtime dependency besides the bundled font.

## Rules that are easy to miss

- Stages are `modules/manifest.json` plus `import.meta.glob` in `src/lib/tabs.ts`. A new panel needs both a manifest entry and a `.svelte` file at that `entry` path.
- Read and write `session.state` (and `session.teams`). `setupStore` is a write-only mirror. Nothing reads it.
- UI refresh is `notifySessionLines()` in `sessionBus.js`. The Alpha window events in `modules/shared/lib/events.ts` have no listeners.
- JS engine files are `@ts-nocheck`. `types.ts` does not list most state fields. Do not "fix" a cast by inventing a second store.
- `attachExtraPositions` and the `#cfg-cert-*` DOM readers are Alpha leftovers. Do not wire them back up. The Build form writes state.
- `build/teams/formExtraTeams.js` runs inside generate. `modules/teams/form.js` is the Teams stage. They both write `session.teams` and do not import each other.
- Teams move is a `<select>`. There is no drag-and-drop.
- Ship fallback import does not replace live lines.

## Do not grow these

| File | Lines | Why |
| --- | --- | --- |
| `modules/build/BuildPanel.svelte` | ~1250 | Period, FTE, shifts, extras, coverage, certs, and import in one component |
| `modules/ship/ebid.js` | ~850 | Columns, row build, CSV, JSON, QA |
| `modules/build/GenerateModal.svelte` | ~750 | Three tools in one view. Logic is already in `generateModal.ts` |
| `modules/build/generateModal.ts` | ~520 | Reimplements `getBandKey` / `formatRdos` that already exist |
| `modules/build/actions/classGenerate.js` | ~510 | Line factory buried under `generateClass` |
| `modules/ship/ShipPanel.svelte` | ~650 | Shrinks once `ebid.js` is split |

Cuts are specified in [RECOMMENDATIONS.md](RECOMMENDATIONS.md). A file under ~250 lines that does one job stays as it is.

## Key files

- `modules/build/session.ts` — `createEmptySession`, attach order, the singleton
- `modules/build/stores/setupStore.js` — `defaultSetupState()` is the state shape
- `modules/build/actions/generate.js` — full generate
- `modules/build/sessionIo.js` — JSON import / export / clear
- `modules/manifest.json` — stage list
- `src/App.svelte` — shell, hash, F-keys, theme
