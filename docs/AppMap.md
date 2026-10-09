# Blade Rebirth App Map

This document provides a visual map of the Blade Rebirth application architecture, showing components and their communication patterns.

## Overview

Blade Rebirth is an offline SPA built with Svelte 5 + Vite. The application centers around a mutable session object that holds application state, with various panels communicating through a session bus.

## Component Interaction Diagram

```mermaid
graph TD
    %% Shell and Routing
    subgraph Shell
        index_html[index.html]
        main_ts[src/main.ts]
        app_svelte[src/App.svelte]
        lib_tabs[src/lib/tabs.ts]
        lib_theme[src/lib/theme.ts]
        events_ts[modules/shared/lib/events.ts]
        
        index_html --> main_ts
        main_ts --> app_svelte
        app_svelte --> lib_tabs
        app_svelte --> lib_theme
        app_svelte --> events_ts
        lib_tabs --> manifest[modules/manifest.json]
    end
    
    %% Central Session
    subgraph Session
        session_ts[modules/build/session.ts]
        session_bus[modules/build/sessionBus.js]
        session_io[modules/build/sessionIo.js]
        setup_store[modules/build/stores/setupStore.js]
        
        session_ts --> session_bus
        session_ts --> session_io
        session_ts --> setup_store
    end
    
    %% Panels
    subgraph Panels
        plan[modules/plan/PlanPanel.svelte]
        build[modules/build/BuildPanel.svelte]
        review[modules/review/ReviewPanel.svelte]
        ship[modules/ship/ShipPanel.svelte]
        present[modules/present/PresentPanel.svelte]
        teams[modules/teams/TeamsPanel.svelte]
        
        %% Review Subs
        review --> lines[modules/review/lines/LinesPanel.svelte]
        review --> coverage[modules/review/coverage/CoveragePanel.svelte]
        review --> reports[modules/review/reports/ReportsPanel.svelte]
    end
    
    %% Build Engine Submodules
    subgraph BuildEngine
        generate[modules/build/actions/generate.js]
        classGenerate[modules/build/actions/classGenerate.js]
        allocation[modules/build/actions/allocation.js]
        parityReport[modules/build/actions/parityReport.js]
        dfoCertBalance[modules/build/actions/dfoCertBalance.js]
        functionCoverage[modules/build/function-coverage/attach.js]
        fte[modules/build/fte]
        certs[modules/build/certs]
        shifts[modules/build/shifts]
        period[modules/build/period]
        schedule[modules/build/schedule]
    end
    
    %% Teams Submodules
    subgraph TeamsEngine
        teamsForm[modules/teams/form.js]
        formExtraTeams[modules/build/teams/formExtraTeams.js]
    end
    
    %% Ship Submodules
    subgraph ShipEngine
        ebid[modules/ship/ebid.js]
    end
    
    %% Communication Links
    %% Shell to Panels (routing)
    lib_tabs -->|loads| plan
    lib_tabs -->|loads| build
    lib_tabs -->|loads| review
    lib_tabs -->|loads| ship
    lib_tabs -->|loads| present
    lib_tabs -->|loads| teams
    
    %% Panels to Session
    plan -.->|no interaction| session_ts
    build -->|reads/writes| session_ts
    review -->|reads/writes| session_ts
    ship -->|reads| session_ts
    present -->|reads| session_ts
    teams -->|reads/writes| session_ts
    
    %% Session Bus Communication
    session_bus -.->|notifySessionLines()| build
    session_bus -.->|notifySessionLines()| review
    session_bus -.->|notifySessionLines()| ship
    session_bus -.->|notifySessionLines()| present
    session_bus -.->|notifySessionLines()| teams
    
    %% Panels to Session Bus
    build -.->|onSessionLines| session_bus
    review -.->|onSessionLines| session_bus
    ship -.->|onSessionLines| session_bus
    present -.->|onSessionLines| session_bus
    teams -.->|onSessionLines| session_bus
    
    %% Build Engine to Session
    generate -->|attach to| session_ts
    classGenerate -->|attach to| session_ts
    allocation -->|attach to| session_ts
    parityReport -->|attach to| session_ts
    dfoCertBalance -->|attach to| session_ts
    functionCoverage -->|attach to| session_ts
    
    %% Teams Engine
    teamsForm -->|writes| session_ts
    formExtraTeams -->|writes| session_ts
    
    %% Ship Engine
    ebid -->|reads| session_ts
    
    %% Styling
    class Shell,Session,Panels,BuildEngine,TeamsEngine,ShipEngine fill:#f9f9f9,stroke:#333,stroke-width:1px;
    class index_html,main_ts,app_svelte,lib_tabs,lib_theme,events_ts fill:#e3f2fd,stroke:#1976d2;
    class session_ts,session_bus,session_io,setup_store fill:#fff3e0,stroke:#f57c00;
    class plan,build,review,ship,present,teams,lines,coverage,reports fill:#e8f5e9,stroke:#388e3c;
    class generate,classGenerate,allocation,parityReport,dfoCertBalance,functionCoverage fill:#f3e5f5,stroke:#6a1b9a;
    class teamsForm,formExtraTeams,ebid fill:#fff8e1,stroke:#ffa000;
```

## Key Communication Patterns

1. **Routing**: `src/lib/tabs.ts` reads `modules/manifest.json` and dynamically loads Svelte components for each tab
2. **State Management**: A single mutable session object (`modules/build/session.ts`) serves as the source of truth
3. **UI Updates**: Components subscribe to session changes via `sessionBus.js`:
   - `onSessionLines(listener)` to subscribe
   - `notifySessionLines()` to broadcast changes
4. **Data Flow**:
   - Build panel: Reads form state → writes to session → triggers UI updates via bus
   - Review/Ship/Present/Teams panels: Read from session → display data
   - Teams panel: Also writes to session (via form interactions)
5. **Direct Module Calls**: Build engine modules attach directly to the session during initialization

## Module Dependencies

### Build Panel Dependencies
- Generate modal (`generateModal.ts`)
- Session (`session.ts`)
- Session bus (`sessionBus.js`)
- Session I/O (`sessionIo.js`)
- Setup store (`setupStore.js`)
- Various action modules (generate, allocation, etc.)

### Review Panel Dependencies
- Session (`session.ts`)
- Session bus (`sessionBus.js`)
- Lines/Coverage/Reports panels (as substabs)

### Ship Panel Dependencies
- Session (`session.ts`)
- Session bus (`sessionBus.js`)
- EBID module (`ebid.js`)

### Present Panel Dependencies
- Session (`session.ts`)
- Session bus (`sessionBus.js`)

### Teams Panel Dependencies
- Session (`session.ts`)
- Session bus (`sessionBus.js`)
- Form module (`teams/form.js`)
- Form extra teams module (`build/teams/formExtraTeams.js`)

## Architectural Notes

- The session is a mutable bag, not a Svelte store
- `setupStore` is a write-only mirror (nothing reads from it)
- UI refresh happens exclusively through `notifySessionLines()` in `sessionBus.js`
- Alpha event listeners in `modules/shared/lib/events.ts` are not used
- JS engine files use `@ts-nocheck` and rely on the session object for state