# Architectural Map: blade-rebirth

## 1. Core Tech Stack & Dependency Graph

### Entry Points
- `src/main.ts` - Application bootstrap (mounts Svelte app to `#app`)
- `index.html` - Root HTML with `<div id="app"></div>` mount point

### Critical Third-Party Libraries
| Package | Version | Role |
|---------|---------|------|
| Svelte | ^5.57.0 | UI framework with reactive statements |
| Vite | ^8.3.0 | Build/dev server (ES modules, HMR) |
| TypeScript | ~6.0.2 | Static typing |
| @sveltejs/vite-plugin-svelte | ^7.3.0 | Svelte integration for Vite |
| svelte-check | ^4.7.6 | Type checking for Svelte components |
| @fontsource/ibm-plex-mono | ^5.2.7 | Monospace font |

### Dependency Graph
```
src/main.ts
├── ./App.svelte (root component)
│   ├── ./lib/tabs.ts (stage routing from manifest.json)
│   ├── ./lib/theme.ts (theme management)
│   └── panels[tab.id] (dynamic stage imports)
├── modules/manifest.json (stage configuration)
└── modules/build/session.ts (shared state singleton)
```

## 2. Module/Directory Map

```
/
├── src/                # Application shell
│   ├── App.svelte      # Main layout with stage navigation
│   ├── main.ts         # Bootstrap
│   ├── app.css         # Global styles
│   └── lib/            # Shared utilities (tabs, theme)
├── modules/            # Stage implementations
│   ├── manifest.json   # Stage registry
│   ├── build/          # Core scheduling engine
│   │   ├── session.ts  # Shared session state creator
│   │   ├── types.ts    # TypeScript interfaces
│   │   ├── actions/    # Business logic (parityReport, dfoCertBalance, generate)
│   │   ├── stores/     # Setup state management
│   │   ├── fte/        # Force-to-equivalence calculations
│   │   ├── shifts/     # Shift math/time utilities
│   │   ├── certs/      # Certification pool management
│   │   ├── function-coverage/ # Function assignment logic
│   │   ├── period/     # Date handling
│   │   ├── sessionIo.js # JSON import/export
│   │   └── sessionBus.js # Line change notifications
│   ├── plan/           # PlanPanel.svelte (timeline stub)
│   ├── review/         # ReviewPanel.svelte + subtabs
│   │   ├── LinesPanel.svelte
│   │   ├── CoveragePanel.svelte
│   │   └── ReportsPanel.svelte
│   ├── ship/           # ShipPanel.svelte (eBid export)
│   ├── present/        # PresentPanel.svelte (placeholder)
│   └── teams/          # TeamsPanel.svelte (RDO auto-form)
├── public/             # Static assets
│   └── favicon.svg
├── dist/               # Build output
└── node_modules/       # Dependencies
```

### Stage Responsibilities
- **build/** - Contains the live scheduling session and core algorithms
- **review/** - Displays lines, coverage reports, and analytics
- **ship/** - Exports scheduling data to eBid format
- **teams/** - Manages team assignments and RDO pattern automation
- **plan/** - Timeline interface for bid periods (minimal implementation)
- **present/** - Presentation mode mount (currently empty)

## 3. Primary Data Flows

### Data Flow Pattern
1. **Input Phase** (Build stage):
   - User enters period, seed, FTE, coverage, cert pools, shifts via BuildPanel
   - Data flows to `session.state` via `sessionIo.applySession()`
   - `setupStore` mirrors critical state for quick access

2. **Generation Phase**:
   - `attachGenerate(session)` generates lines based on inputs
   - Lines stored in `session.state.lines`
   - Schedule/RDO patterns stored in `session.state.schedule`

3. **Analysis Phase** (Review stage):
   - LinesPanel reads `session.state.lines` and `session.state.schedule`
   - CoveragePanel calculates coverage from lines + function assignments
   - ReportsPanel aggregates statistics from session state

4. **Mutation Phase**:
   - ParityReport: analyzes lines for RDO disparities → returns proposals
   - User approves swaps → `approveParitySwaps()` updates RDO patterns
   - DFO Certificate Balance: analyzes certification needs → returns proposals
   - User approves moves → `approveDfoCertBalance()` updates assignments

5. **Export Phase** (Ship stage):
   - `sessionIo.exportSession()` serializes full session to JSON
   - ShipPanel transforms lines to eBid 45-column CSV format

### Critical Data Path
```
User Input → sessionIo.applySession() → session.state
              ↓
        attach*() functions (enrich session with methods)
              ↓
     Business Logic (parityReport.js, dfoCertBalance.js)
              ↓
     UI Components (read session.state, display results)
              ↓
   User Actions → approve*() functions → modify session.state
              ↓
   sessionIo.exportSession() → JSON blob → file download
```

## 4. State & Context Management

### Shared Session State
- **Location**: `modules/build/session.ts` → `createEmptySession()` function
- **Structure**: Single `session` object exported as singleton (line 64)
- **Initialization**: Created once at module load, never replaced
- **Mutation**: Properties modified in-place; never reassigned

### State Categories
1. **Setup State** (`session.state`):
   - Period configuration (open/close, dates, weeks)
   - FTE counts (full-time, part-time)
   - Shift definitions and crew groups
   - Function coverage requirements
   - Certification pool configuration
   - Extra positions and training classes

2. **Results State** (`session.state`):
   - Generated lines (`lines[]`)
   - Work/RDO schedule (`schedule[lineId][]`)
   - Function assignments (`functionRotation`)
   - Teams composition (`session.teams.teams`)
   - Mode indicator and issues list

3. **Runtime Attachments** (added to session object):
   - Methods: `generate()`, `checkParity()`, `approveParitySwaps()`, etc.
   - Utilities: `timeToMin`, `isValidTimeText`, `buildExtraPositionLines`
   - References: `teams`, `BADGES`, various helper functions

### Synchronization Mechanisms
- **sessionBus.js**: Publish/subscribe for line change notifications
  - `notifySessionLines()` called after state mutations
  - Ship panel subscribes to refresh eBid export
- **setupStore.js**: Mirror of critical setup state for quick access
  - Updated via `mirrorStore()` in sessionIo
  - Used by non-build modules needing setup data
- **JSON Import/Export**: Full state serialization via sessionIo
  - `applySession()` deserializes and validates incoming state
  - `exportSession()` creates versioned JSON blob

### Immutability Notes
- Despite using plain objects, state mutations follow explicit patterns
- No direct property assignment outside of sessionIo/mirrorStore
- Array mutations use splice/push but are channeled through specific functions
- TypeScript interfaces in `types.ts` define shape but not immutability
