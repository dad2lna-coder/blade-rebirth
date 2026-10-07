# blade-rebirth

Reimagining of [BLADE_Alpha](https://github.com/dad2lna-coder/BLADE_Alpha), the offline airport staffing scheduler for TSO / LTSO / STSO bid lines.

Alpha is the reference implementation and stays where it is. This repo is a clean start: same job, new structure. Do not port Alpha wholesale.

Sibling runtime: [BLADE-Runtime](https://github.com/dad2lna-coder/BLADE-Runtime).

**Status:** Svelte 5 app. One shared session. Stages come from `modules/manifest.json`: Plan, Build, Review (Lines / Coverage / Reports), Ship, Present, Teams.

Plan is a timeline stub. It does not read the period and it does not upload. Build is the setup form and the generate engine. Review, Ship, Present, and Teams read that same session. Present is a figure strip (period, hours, lines, FTE), not a slide deck. Teams auto-forms by RDO and start time; people move with a select, not drag-and-drop. No intro.

Map, module graph, and npm pins: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). File splits: [RECOMMENDATIONS.md](RECOMMENDATIONS.md). What still has to match Alpha: [docs/PORT-FROM-ALPHA.md](docs/PORT-FROM-ALPHA.md). Order of work: [docs/MIGRATION.md](docs/MIGRATION.md).

**Live:** https://dad2lna-coder.github.io/blade-rebirth/

## Run

```bash
npm install
npm run dev
```

The shell opens on Plan. F1–F6 switch stages. Review opens Lines, Coverage, and Reports. Dark and Presentation are saved in this browser.

---

## What it does

Build balanced security bid lines from shift force and FTE, then show whether those lines cover the operation.

| Surface | Job |
| --- | --- |
| Plan | Bid-period timeline. Not wired to the session. No upload. |
| Build | Setup inputs on the shared session: period, seed, FTE, function coverage, cert pools, shifts. GENERATE uses them. |
| Review | Lines, coverage, and reports |
| Ship | eBid 45-column sheet from the live session. JSON/CSV import is a fallback preview and does not replace lines. |
| Present | Read-only snapshot of this session |
| Teams | Auto-form by RDO and start window. Move with a select |

Generate assigns function duties (BAG / DFO / PAX) in the same pass as the lines. Session JSON import and export round-trip the setup, the lines, the schedule, and the teams. Airport open and close live on that session. There is no separate airfield, terminal, or checkpoint model.

---

## Constraints

- Offline-first. No CDN. No server required to run the scheduler.
- The only runtime package is `@fontsource/ibm-plex-mono`, bundled by Vite. Svelte and Vite are devDependencies. Do not add a CDN script.
- One shared session. The shell renders. Feature work stays in its module. `setupStore` is a write-only mirror — do not read it.
- Desktop wrap is Tauri when a wrapper is needed. Distribution can be a shared folder; GitHub is source.

Alpha today is an HTML/JS shell plus Vite-built ES module panels (`modules/manifest.json`). Rebirth may keep that split or collapse it. The product surface above is the contract, not the file tree.

---

## Reference

- App: https://github.com/dad2lna-coder/BLADE_Alpha
- Live Alpha: https://dad2lna-coder.github.io/BLADE_Alpha/
- Runtime: https://github.com/dad2lna-coder/BLADE-Runtime

Use Alpha for behavior. Use this repo for the rewrite.
