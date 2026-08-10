# Design

Warpkey binds a leader-key chord (default `` ` `` then a letter) to a DOM action
(click / focus / scroll-to) on a specific site, recorded by example.

## Binding target: (hostname, DOM selector), not URL pattern

Bindings key off the hostname plus a recorded DOM selector, not the URL path.
A selector like a `data-testid` naturally generalizes across pages under a site
(e.g. `/analytics/abcdef` and `/analytics/djfoiejwof`) without needing to detect
that "abcdef" and "djfoiejwof" are interchangeable path IDs. An optional
`pathPrefix` lets a binding be restricted to part of a site where the same key
should mean something else (e.g. different sections of one app).

Each binding also stores `recordedPath` (`location.pathname` at record time).
The popup renders this as clickable breadcrumb chips - "any path" plus one
chip per path segment - so trimming scope is click-to-truncate rather than
freeform regex/glob editing: clicking `analytics` sets `pathPrefix` to
`/analytics` (fires anywhere under that section); clicking a deeper segment
narrows further; "any path" clears the restriction entirely. See
`renderScopeRow` in `src/popup/main.ts`.

**Scope cut for v1: global/fixed-chrome actions only** (compose button, search,
settings/nav links). Contextual per-item actions ("archive THIS email row") are
out of scope - a single recorded selector can't express "the item I'm looking
at right now." See `docs/feasibility.md`. Candidate v2 approaches: resolve
relative to current focus/hover, or a Vimium-style hint overlay for
disambiguation.

## Selector strategy: ranked fallback chain

Recorded at bind time, tried in order at fire time until one resolves to
exactly one element: `data-testid` → `id` → ARIA role + accessible name →
structural CSS path (`tag:nth-of-type(n)` chain). See `src/content/selector.ts`.

## Selector drift safety: fingerprint check

A binding also records a fingerprint (visible text / `aria-label`) of its
target. At fire time, if the resolved element's fingerprint doesn't match, the
binding is treated as stale and the action is skipped with a visible notice
instead of firing on the wrong element.

Comparison normalizes away digit runs (`"clicks: 0"` vs. `"clicks: 1"` count
as equal) so elements whose visible text legitimately changes as a side
effect of the bound action itself - unread counts, cart badges, "N selected"
- don't get falsely flagged as stale on the very first fire after recording.
A real text change (e.g. a button relabeled from "Archive" to "Delete") still
correctly trips the stale check. See `normalizeVolatileText` in
`src/shared/text.ts`.

## Key model: leader-key chord, not per-binding modifiers

Default leader key `` ` ``, shown at the top of the popup and changeable by
clicking it and pressing a new key. It's a single global setting (stored
separately from per-host bindings, see "Storage" below), not per-site. Press
leader → a short-lived "which key?" overlay lists bindings for the current
site (labeled by their key alone, e.g. `x`, not `` `x``, since the leader is
implied) → next keypress fires the match or the chord times out / cancels on
Escape. Chosen over Alt/Ctrl+key combos, which collide with OS/browser chrome
(Alt-tap opens the native menu on Windows; Ctrl+key is heavily claimed by
browsers), and because a two-key chord starting with a rare trigger key is
very unlikely to collide with any site's own single-key shortcuts. Suppressed
while focus is in an editable field, so it doesn't interfere with typing.

## Recording

Popup "Record" button arms the active tab's content script (message passing),
then closes itself immediately (`window.close()`) rather than waiting for the
user to click away - a click outside the popup dismisses it without also
reaching the page, so leaving it open would silently swallow the user's next
click instead of having the content script see it. The next click on the
page is captured, walked up to the nearest interactive ancestor (button,
link, role, form control), and turned into a selector chain + fingerprint.
The action type is inferred: form controls → `focus`, everything else →
`click`. The user then presses the key to bind (Escape cancels), and the
binding is saved directly to `chrome.storage.sync`.

## Storage

`chrome.storage.sync`, one JSON object keyed by hostname, each holding a list
of bindings (`{ id, key, selector, fingerprint, action, recordedPath, pathPrefix?, createdAt }`),
plus a separate top-level key for the global leader key setting. Gives
cross-device sync; known quota risk for heavy users (~8KB per item, ~100KB
total) noted in the feasibility doc.

The popup also reuses the digit-normalization from the drift check (see
above) when displaying a binding's label, so a stored fingerprint like
`"clicks: 0"` renders as `"clicks: #"` rather than a frozen count that never
matches what's actually on the page after the binding has fired. See
`src/shared/text.ts`.

## Known v1 limitations (documented, not fixed)

- **Synthetic events aren't trusted** (`isTrusted: false`) - some sites'
  bot-detection or framework code may ignore or flag dispatched clicks. Not
  fixed in v1 (rejected `chrome.debugger`-based real input dispatch: too
  heavy for an always-on tool - persistent "debugging this browser" banner).
- **Shadow DOM** - selectors can't pierce shadow boundaries (open or closed).
  Affects specific widgets, not whole sites, for the target use case.
- **Cross-origin iframes** - unreachable by the content script; rare for the
  primary actions this tool targets.
