# Warpkey

Chrome MV3 extension: press a leader key (default `` ` ``), then a letter, to
click/focus/scroll-to a recorded element on the current site.

## Stack
TypeScript, Vite + `@crxjs/vite-plugin`, vanilla popup (no UI framework).
`chrome.storage.sync` for persistence. No unit test setup yet - see
"Current scope" below.

## Commands
- `npm run dev` - Vite dev server with HMR for the content script
- `npm run build` - type-check + production build to `dist/`

## Load in Chrome
`npm run build`, then `chrome://extensions` → Developer Mode → Load unpacked → `dist/`.

## Architecture
- `src/content/index.ts` - orchestrates: loads bindings, wires leader controller + recorder
- `src/content/leader.ts` - leader-key chord state machine
- `src/content/overlay.ts` - shadow-DOM-hosted "which key?" / status panel
- `src/content/selector.ts` - selector-chain build/resolve, fingerprint drift check, action execution
- `src/content/recorder.ts` - record-mode click capture → key capture → save binding
- `src/storage/store.ts` - `chrome.storage.sync` read/write: per-host bindings plus the global leader key
- `src/shared/text.ts` - digit-normalization for drift detection; quoting helper for on-page-text labels
- `src/shared/labels.ts` - resolves what to display for a binding (custom name > live page text > action), shared by the popup and the on-page overlay
- `src/shared/constants.ts` - `DEFAULT_LEADER_KEY`
- `src/popup/` - list/delete/rescope bindings for the active tab's site, arm recording, view/change the leader key

Design rationale and the adversarial feasibility review live in `docs/design.md`
and `docs/feasibility.md` - read those before changing the binding model,
selector strategy, or key-capture approach.

## Current scope
v1 only supports bindings to fixed/global elements (nav, compose, search,
settings). Per-item/contextual actions are an explicit, documented v2 gap -
see `docs/design.md`.

## TODO
- Unit tests for pure logic (`normalizeVolatileText`/`quoteLiveLabel` in
  `src/shared/text.ts`, selector-chain build/resolve in
  `src/content/selector.ts`). Deferred: no meaningful logic complex enough
  to warrant it yet, and Vitest/`npm test` were removed as unused after
  sitting with zero test files. Add a test runner back when there's an
  actual test to write.
