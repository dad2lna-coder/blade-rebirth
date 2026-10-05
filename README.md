# blade-rebirth

Reimagining of [BLADE_Alpha](https://github.com/dad2lna-coder/BLADE_Alpha), the offline airport staffing scheduler for TSO / LTSO / STSO bid lines.

Alpha is the reference implementation and stays where it is. This repo is a clean start: same job, new structure. Do not port Alpha wholesale.

Sibling runtime: [BLADE-Runtime](https://github.com/dad2lna-coder/BLADE-Runtime).

**Status:** frontend shell. Tabs load from `modules/manifest.json`. The Setup tab mounts the generate modal. Other tabs are stubs. Alpha event names are reserved on the shared bus. No intro and no staffing logic.

**Live:** https://dad2lna-coder.github.io/blade-rebirth/

## Run

```bash
npm install
npm run dev
```

The shell opens on the Setup mount. F1–F6 switch tabs. Dark and Presentation are saved in this browser.

---

## What it does

Build balanced security bid lines from shift force and FTE, then show whether those lines cover the operation.

| Surface | Job |
| --- | --- |
| Setup | Weeks, FTE by role and sex, BAG and DFO pools, shifts, Generate |
| Lines | Bid-line table, row model, Excel export |
| Coverage | 30-minute headcount, shift mix, coverage cuts |
| Reports | Passenger, bag-DFO, total, and pool views; capacity math |
| Teams | Architecture, auto-form by RDO, drag-drop boards |
| Capacity | Checkpoint lane demand and mod-set board |
| Demand | Flight-volume import vs PAX staffing capacity |

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
