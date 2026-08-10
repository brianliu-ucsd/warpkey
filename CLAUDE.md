# Warpkey

Chrome MV3 extension: press a leader key (default `` ` ``), then a letter, to
click/focus/scroll-to a recorded element on the current site.

## Stack
TypeScript, Vite + `@crxjs/vite-plugin`, vanilla popup (no UI framework),
Vitest for unit tests. `chrome.storage.sync` for persistence.

## Commands
- `npm run dev` - Vite dev server with HMR for the content script
- `npm run build` - type-check + production build to `dist/`
- `npm test` - Vitest

## Load in Chrome
`npm run build`, then `chrome://extensions` → Developer Mode → Load unpacked → `dist/`.

## Architecture
- `src/content/index.ts` - orchestrates: loads bindings, wires leader controller + recorder
- `src/content/leader.ts` - leader-key chord state machine
- `src/content/overlay.ts` - shadow-DOM-hosted "which key?" / status panel
- `src/content/selector.ts` - selector-chain build/resolve, fingerprint drift check, action execution
- `src/content/recorder.ts` - record-mode click capture → key capture → save binding
- `src/storage/store.ts` - `chrome.storage.sync` read/write: per-host bindings plus the global leader key
- `src/shared/text.ts` - digit-normalization used by both drift detection and popup display labels
- `src/shared/constants.ts` - `DEFAULT_LEADER_KEY`
- `src/popup/` - list/delete/rescope bindings for the active tab's site, arm recording, view/change the leader key

Design rationale and the adversarial feasibility review live in `docs/design.md`
and `docs/feasibility.md` - read those before changing the binding model,
selector strategy, or key-capture approach.

## Current scope
v1 only supports bindings to fixed/global elements (nav, compose, search,
settings). Per-item/contextual actions are an explicit, documented v2 gap -
see `docs/design.md`.
