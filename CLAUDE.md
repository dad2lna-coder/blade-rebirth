# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working on this project.

## Project Overview

**blade-rebirth** is a rewrite of BLADE_Alpha, an offline airport staffing scheduler for TSO/LTSO/STSO bid lines. It uses Svelte 5 + Vite, running as a single-page application with a shared session store.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type checking
npm run check
```

## Architecture

- **Multi-stage shell**: Plan → Build → Review (Lines/Coverage/Reports) → Ship → Present → Teams
- **Shared session store**: One session object in `/modules/build/session.ts` holds all scheduling state
- **Plugin pattern**: `attach*` functions wire implementations into the session object
- **Offline-first**: No CDN, no server required

## Key Files

- `/modules/build/session.ts` - `createEmptySession()` creates the shared state object
- `/modules/build/types.ts` - TypeScript type definitions
- `/modules/build/actions/*.js` - Core logic (parityReport.js, dfoCertBalance.js, generate.js)
- `/modules/manifest.json` - Stage configuration
- `/src/App.svelte` - Main shell with stage navigation

## Build System

Vite builds ES modules from `modules/` directory. The app mounts at `#app` in index.html.