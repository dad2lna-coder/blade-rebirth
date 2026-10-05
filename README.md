# blade-rebirth

Reimagining of [BLADE_Alpha](https://github.com/dad2lna-coder/BLADE_Alpha), the offline airport staffing scheduler for TSO / LTSO / STSO bid lines.

Alpha is the reference implementation and stays where it is. This repo is a clean start: same job, new structure. Do not port Alpha wholesale.

Sibling runtime: [BLADE-Runtime](https://github.com/dad2lna-coder/BLADE-Runtime).

**Status:** frontend shell. Stages load from `modules/manifest.json`: Plan, Build, Review (Lines / Coverage / Reports), Ship, Present, Teams. Plan is a timeline stub with no upload. Build owns the Setup mount (period, FTE, function coverage, generate later). Ship owns the eBid 45-column mount. Present is empty. No intro. Engines stay in Alpha.

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
| Plan | Bid-period timeline. No upload. |
| Build | Setup mount: period, FTE, function coverage. Generate later. |
| Review | Lines, coverage, and reports |
| Ship | eBid 45-column sheet |
| Present | Presentation mount |
| Teams | Architecture, auto-form by RDO, drag-drop boards |

Generate assigns function duties (BAG / DFO / PAX) in the same pass as the lines. Session state imports and exports as JSON. Airport hours, terminals, and checkpoints live in an airfield setup.

---

## Constraints

- Offline-first. No CDN. No server required to run the scheduler.
- Vendor libraries live in the project (or a shared local folder), not on the network.
- One shared session store. Shell renders. Feature work stays in its own module.
- Desktop wrap is Tauri when a wrapper is needed. Distribution can be a shared folder; GitHub is source.

Alpha today is an HTML/JS shell plus Vite-built ES module panels (`modules/manifest.json`). Rebirth may keep that split or collapse it. The product surface above is the contract, not the file tree.

---

## Reference

- App: https://github.com/dad2lna-coder/BLADE_Alpha
- Live Alpha: https://dad2lna-coder.github.io/BLADE_Alpha/
- Runtime: https://github.com/dad2lna-coder/BLADE-Runtime

Use Alpha for behavior. Use this repo for the rewrite.
