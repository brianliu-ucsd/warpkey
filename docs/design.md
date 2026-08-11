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
The ARIA tier matches on exact accessible-name text first, falling back to a
volatile-count-normalized comparison only if no exact match is unique - so
two distinct same-role elements that differ only by a live count (e.g. two
"Upvote N" buttons) stay disambiguated, while a single recorded element whose
own count has since drifted still resolves.

## Selector drift safety: fingerprint check

A binding also records a fingerprint (visible text / `aria-label`) of its
target. At fire time, if the resolved element's fingerprint doesn't match, the
binding is treated as stale and the action is skipped with a visible notice
instead of firing on the wrong element - *unless* the element resolved via
`testId` or `id` (see "Selector strategy" above), which identify an element
independent of its text and so are trusted regardless of drift; a text change
there reads as a relabel, not a wrong-element hit. The `aria`/`structural`
tiers can land on a different element that merely occupies the same role or
position, so those still go through the fingerprint comparison. (A
similarity-threshold approach - block only "big" text changes - was rejected:
edit distance doesn't track semantic distance, e.g. "Unsubscribe" →
"Subscribe" is a tiny diff with inverted meaning.)

Comparison normalizes away volatile counts: both a bare digit-run value
change (`"clicks: 0"` vs. `"clicks: 1"`) and a count badge that disappears
entirely at zero (GitHub's Issues tab renders bare `"Issues"` with no count
markup when a repo has none, vs. `"Issues814 (814)"` when it doesn't) - the
parenthetical fragment has to be stripped as a unit, not just its digits, or
an empty `"( )"` shell is left behind that doesn't match the count-free case.
This keeps elements whose text legitimately varies - unread counts, cart
badges, a binding firing against a different record with a different count -
from being falsely flagged as stale. A real text change still correctly trips
the check when only a weak tier matched. See `normalizeVolatileText` in
`src/shared/text.ts` and `resolveSelector` in `src/content/selector.ts`.

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

The leader key alone always arms the overlay, even on a site with zero
recorded bindings - there's no early-return on an empty binding list, because
there's always at least one thing to show (see next paragraph). Contrast this
with a per-site binding, which only shows once at least one exists.

leader+r is a permanent built-in chord, shown first in the which-key overlay
and in the popup, separated from the site's own bindings by a divider once
any exist (`src/content/overlay.ts`'s `separator` entry flag, set by
`src/content/leader.ts`). It arms recording - equivalent to the popup's
"Record new binding" button, but reachable without opening the popup first.
`RECORD_KEY` (`src/shared/constants.ts`) is reserved: `src/content/recorder.ts`
rejects an attempt to record a binding on it, and the chord dispatcher in
`src/content/leader.ts` checks it before scanning user bindings, so a legacy
binding recorded on `r` before this existed is shadowed by the built-in
rather than firing. (A leader+leader chord to open the popup itself was tried
and removed - `chrome.action.openPopup()` isn't reliably callable from a
service worker relaying a keypress-triggered message, since it doesn't
consistently carry the required user-gesture flag.)

## Recording

Popup "Record" button arms the active tab's content script (message passing),
then closes itself immediately (`window.close()`) rather than waiting for the
user to click away - a click outside the popup dismisses it without also
reaching the page, so leaving it open would silently swallow the user's next
click instead of having the content script see it. Recording can also be
armed directly on the page via leader+r, without opening the popup at all.
Escape cancels at any point after arming - both while waiting for the target
click and, as before, while waiting for the key to bind. The next click on the
page is captured in the capture phase with `preventDefault`/`stopPropagation`
called immediately, so the click is recorded but never actually happens -
no navigation, form submission, or site-side click handler runs. This
matters most for links: recording a binding on a link that routes elsewhere
(including off-site) shouldn't require actually going there. The captured
target is walked up to the nearest interactive ancestor (button, link, role,
form control) and turned into a selector chain + fingerprint. The action
type is inferred: form controls → `focus`, everything else → `click`. The
user then presses the key to bind (Escape cancels), and the
binding is saved directly to `chrome.storage.sync`. The overlay then confirms
what happened - `` Warpkey: bound "x" to "Compose button" `` - for the same
`CONFIRMATION_DISPLAY_MS` window used elsewhere, so a successful bind is
visible without having to open the popup to check.

The key the user presses is validated before it's accepted: `RECORD_KEY`
(reserved for the built-in leader+r chord) and any key already bound on this
host are both rejected with a message explaining why, and the capture loop
keeps listening rather than cancelling - the user just picks another key.
Duplicates are checked host-wide, not against the current path, because a
freshly recorded binding always starts unscoped (`pathPrefix` unset, fires on
every path) until the popup's breadcrumb chips narrow it afterward - see
"Binding target" below - so at record time there's no scope yet to compare
against. The one collision this can't catch: two devices recording the same
key on the same host at nearly the same moment, before `chrome.storage.sync`
propagates between them - not addressed, see the TODO in `CLAUDE.md`.

## Storage

`chrome.storage.sync`, one JSON object keyed by hostname, each holding a list
of bindings (`{ id, key, selector, fingerprint, action, recordedPath, pathPrefix?, createdAt }`),
plus a separate top-level key for the global leader key setting. Gives
cross-device sync; known quota risk for heavy users (~8KB per item, ~100KB
total) noted in the feasibility doc.

## Display labels: custom name, else live page text, else the action

A binding may have a user-given `name` (below); if unset, the label falls
back to live on-page text rather than the stored fingerprint. The stored
`fingerprint` is a record-time snapshot used only for drift detection
(above) - showing it directly as a label would freeze at whatever text
existed the moment the binding was recorded, which for a target like a click
counter is stale from the very first use. Resolution is centralized in
`resolveDisplayLabel` (`src/shared/labels.ts`) so the popup and the on-page
overlay stay identical:

- The on-page "which key?" overlay resolves live directly, since it already
  runs in the same document as the target (`liveLabel` in `src/content/leader.ts`).
- The popup can't touch the target's DOM itself (it's a separate extension
  page), so it asks the active tab's content script to resolve each binding
  and report back the current text (`RESOLVE_LABELS_MESSAGE` in
  `src/content/messages.ts`, handled in `src/content/index.ts`). This only
  works when the binding's target is actually present on the currently open
  page; elsewhere it falls back to the stored fingerprint.

A target's on-page text can be anything - including something that reads like
an app-native stat, e.g. a click counter or unread badge - which risks being
mistaken for a value Warpkey itself computed (a per-binding usage count, say;
it tracks none). Labels sourced from real page text are wrapped in curly
quotes and styled italic (`quoteLiveLabel` in `src/shared/text.ts`) to mark
them as a literal excerpt; a custom name or the bare action name
(`click`/`focus`/`scroll-to`) are shown unquoted, since neither is page text.
Quoting is the general fix - it holds for any site's own confusing element
text, not just this project's test fixture.

## Renaming a binding

Click a binding's label in the popup to rename it (`startRename` in
`src/popup/main.ts`): it swaps in a text input, Enter or blur saves, Escape
cancels. Saving an empty value clears the name, reverting to the live/
fingerprint/action fallback above. The name is stored directly on the
binding (`Binding.name`) via the existing `updateBinding`, so it syncs and
propagates to the on-page overlay the same way any other binding edit does.

## Known v1 limitations (documented, not fixed)

- **Synthetic events aren't trusted** (`isTrusted: false`) - some sites'
  bot-detection or framework code may ignore or flag dispatched clicks. Not
  fixed in v1 (rejected `chrome.debugger`-based real input dispatch: too
  heavy for an always-on tool - persistent "debugging this browser" banner).
- **Shadow DOM** - selectors can't pierce shadow boundaries (open or closed).
  Affects specific widgets, not whole sites, for the target use case.
- **Cross-origin iframes** - unreachable by the content script; rare for the
  primary actions this tool targets.
