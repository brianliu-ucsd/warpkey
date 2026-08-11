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
- `src/content/leader.ts` - leader-key chord state machine, including the built-in leader+r chord
- `src/content/overlay.ts` - shadow-DOM-hosted "which key?" / status panel
- `src/content/selector.ts` - selector-chain build/resolve, fingerprint drift check, action execution
- `src/content/recorder.ts` - record-mode click capture → key capture → save binding
- `src/storage/store.ts` - `chrome.storage.sync` read/write: per-host bindings plus the global leader key
- `src/shared/text.ts` - digit-normalization for drift detection; quoting helper for on-page-text labels
- `src/shared/labels.ts` - resolves what to display for a binding (custom name > live page text > action), shared by the popup and the on-page overlay
- `src/shared/constants.ts` - `DEFAULT_LEADER_KEY`, `RECORD_KEY` (reserved for leader+r)
- `src/popup/` - list/delete/rescope bindings for the active tab's site, arm recording, view/change the leader key, shows the built-in leader+r shortcut

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
- `public/icons/icon{16,32,48,128}.png` are a generated placeholder (slate
  square, amber chevron mark) - swap in real artwork at the same paths and
  sizes when it's ready, then `npm run build` and reload the unpacked
  extension to see it.
- Duplicate binding keys are rejected at record time (`src/content/recorder.ts`
  checks the host's existing bindings, same UX as the reserved-key check).
  The one gap this doesn't close: two devices recording the same key on the
  same host near-simultaneously, before `chrome.storage.sync` propagates
  between them, can still race past each other. Not fixable without
  server-side locking this extension doesn't have; not worth building for
  until someone actually hits it.
