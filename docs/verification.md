# Verification

Manual test flows for Warpkey. There's no automated coverage yet - MV3
content-script/DOM interaction can't be exercised without a browser, and
there's no unit test runner set up either (see the TODO in `CLAUDE.md`).
Each flow below references the `docs/design.md` section it's checking.

## Load the extension

1. `cd ~/Projects/warpkey && npm run build`
2. `chrome://extensions` → enable **Developer mode** (top right)
3. **Load unpacked** → select the `dist/` folder
4. After any code change: `npm run build` again, then click the reload icon
   on Warpkey's card in `chrome://extensions`, then reload any tab you're
   testing on (content scripts only (re-)inject on page load)

### Serving the test fixture

Flows below use `test-pages/fixture.html`, a static page with known DOM
structure, so selector-tier and drift tests are repeatable instead of
depending on a live site's current markup. Serve it locally rather than
opening via `file://` (Chrome content scripts don't run on `file://` URLs
unless you separately grant "Allow access to file URLs" per extension):

```
python3 -m http.server 8000 --directory test-pages
```

Then open `http://localhost:8000/fixture.html`.

## Usability test flows

Flows 1 and 3-6 use the fixture's counter-driven targets, which double as a
regression check for fingerprint digit-normalization: the recording click
itself bumps the counter (e.g. from "clicks: 0" to "clicks: 1") after the
fingerprint was captured, so the very first fire afterward would show a
mismatch if digit runs weren't normalized away. If any of these flows report
"looks stale" on the first fire, that normalization has regressed - see
"Selector drift safety" in `docs/design.md`. Flows 9-10 test the other side
of that same mechanism directly: a trusted-tier match (`id`/`testId`) should
survive a real text change without going stale, while a weak-tier
(`structural`) match still should not.

| # | Competency (design.md ref) | Steps | Expected result |
|---|---|---|---|
| 1 | Core record → fire loop ("Recording", "Key model") | On the fixture page: open popup → **Record** → click the **TestID-tier button** → press `x`. Then press `` ` `` then `x` anywhere on the page. | Popup shows the new binding. `` ` x `` increments the testid counter - same as clicking it directly, not flagged as stale. |
| 2 | Editable-field guard ("Key model") | Click into the fixture's text input, type a sentence containing a backtick, e.g. `` the `quick` fox ``. | Both backticks are inserted as literal characters - leader mode never arms, typing is uninterrupted. |
| 3 | Selector fallback - id tier | Record a binding on the **ID-tier button** (`x` counter). Fire it after a page reload. | Fires correctly; recorded selector has `id` set and no `testId`. |
| 4 | Selector fallback - aria tier | Record a binding on the **Aria-tier target** (`div[role=button]`). Fire it after a page reload. | Fires correctly; recorded selector has `ariaRole`/`ariaName` set, no `id`/`testId`. |
| 5 | Selector fallback - structural tier | Record a binding on the **Structural-tier target** (the plain `<span>`). Fire it after a page reload. | Fires correctly via `structuralPath` alone - the weakest tier, worth confirming it isn't silently broken. |
| 6 | Selector fallback - testid tier | Record a binding on the **TestID-tier button** (as in #1). In devtools console: `document.querySelector('[data-testid="warpkey-testid-button"]').removeAttribute('id')` (no-op, it has none) - instead confirm via console that `chrome.storage` recorded `selector.testId` set. | Binding's stored selector has `testId` populated; firing still works after a page reload. |
| 7 | Action-type inference ("Recording") | Record a binding on the **focus-target** `<input>`. Click elsewhere to blur it, then fire the binding. | The input receives focus (cursor appears in it) - not a click. |
| 8 | Recording a link doesn't navigate ("Recording") | On the fixture page, open popup → **Record** → click the **Navigation-tier link** (bottom of the page, links to `example.com`) → press `y`. | The page stays on `fixture.html` - no navigation to `example.com` at any point. The prompt overlay still progresses normally ("now press the key…" then the bound confirmation). Firing `` ` y `` afterward *does* navigate (that's the bound action actually running, not a recording side effect). |
| 9 | Selector drift on a trusted tier (`id`) doesn't misfire as stale ("Selector drift safety") | Record a binding on the **ID-tier button**. In devtools console, change its text: `document.getElementById('warpkey-id-button').firstChild.textContent = 'Changed!'`. Fire the binding. | The binding fires normally - the button's click handler runs and its counter increments - with **no** stale warning. An `id` (or `testId`) match identifies the same element independent of its text, so a relabel alone doesn't block the action; see "Selector drift safety" in `docs/design.md`. |
| 10 | Selector drift on a weak tier (`structural`) still trips the stale warning ("Selector drift safety") | Record a binding on the **Structural-tier target**. In devtools console, change its text: `document.querySelector("[onclick*='structural']").firstChild.textContent = "Renamed target - clicks: "`. Fire the binding. | Overlay shows a "looks stale - re-record it?" message; the click handler does **not** run (counter doesn't increment). Unlike `id`/`testId`, a `structural`-tier match isn't independently confirmed to be the same element, so a real label change (not just the volatile digit count) still blocks the action. |
| 11 | Popup and overlay labels reflect live state, and read as quoted page text ("Display labels") | Record a binding on the **TestID-tier button** (as in #1), fire it a couple more times (count should be at 2+), then reopen the popup and separately press the leader key alone to check the which-key overlay. | Both the popup's binding row and the overlay's list show the button's actual current text in curly quotes and italics (e.g. `"TestID-tier button - clicks: 2"`), not the frozen `"...clicks: 0"` captured at record time and not a bare unquoted number that could read as a Warpkey-native usage count. |
| 12 | Escape cancels an armed chord ("Key model") | Press `` ` ``, then press `Escape`. | Overlay disappears immediately, no action fires. |
| 13 | No-bindings no-op (edge case) | On a fresh hostname with zero recorded bindings, press `` ` ``. | Nothing happens - no overlay flash, no error in the console. |
| 14 | Leader overlay + timeout ("Key model") | With at least one binding recorded, press `` ` `` and wait ~2s without pressing another key. | The "which key?" overlay appears listing bindings, then disappears on its own after ~1.5s. |
| 15 | Recording: Escape cancels ("Recording") | Open popup → **Record** → click any target → press `Escape` instead of a key. | Overlay hides, popup shows no new binding was added. |
| 16 | Bind confirmation message ("Recording") | Open popup → **Record** → click any target → press a key to bind it. | The bottom-right overlay updates to a confirmation naming both the key and the target, e.g. `Warpkey: bound "x" to "TestID-tier button - clicks: 0"`, staying visible for ~1.8s before clearing on its own. |
| 17 | Recording: key-capture timeout ("Recording") | Open popup → **Record** → click a target → wait 10+ seconds without pressing a key. | The prompt overlay clears itself; no binding is saved (confirm via popup). |
| 18 | Popup delete ("Storage") | With 2+ bindings recorded, delete one via the popup's ✕. | The deleted binding no longer fires; the other still does; popup list updates live. |
| 19 | Leader key is editable ("Key model") | In the popup, click the leader-key `kbd` in the header (shows `` ` `` by default), then press a different key, e.g. `j`. No reload needed - the change propagates live. Try `` ` `` then an existing binding's key, then try `j` then that same key - as two separate presses, not simultaneous (the leader alone only opens the which-key overlay; it still takes a second keypress to fire). | `` ` `` no longer arms the chord; `j` does. Reopening the popup shows `j` as the current leader key. |
| 20 | Persists across SPA navigation ("Binding target") | Record a global binding on a real client-routed app (e.g. GitHub's left nav). Navigate to another in-app route without a full page reload. Fire the binding. | Still fires correctly - bindings are hostname-scoped and `location.pathname` is read live at fire time, not cached at page load. |
| 21 | Path-scoped binding via breadcrumb chips ("Binding target") | Record a binding on a page with a multi-segment path (e.g. a GitHub repo's Issues tab, `/owner/repo/issues`). In the popup, click the `repo`-segment chip instead of leaving it on "any path". Navigate to a sibling route under the same `/owner/repo` prefix (e.g. `/owner/repo/pulls`) and fire the binding, then navigate to an unrelated path (e.g. `/owner/other-repo`) and try again. | Fires on `/owner/repo/pulls` (shares the selected prefix) but not on `/owner/other-repo` (doesn't). Reopening the popup shows the chosen chip still highlighted. |
| 22 | Clearing scope back to "any path" ("Binding target") | With the scoped binding from #21, reopen the popup and click the **any path** chip. | Binding now fires on both the original and the unrelated path; **any path** chip shows as active, no chip from #21 remains active. |
| 23 | Renaming a binding, with fallback ("Renaming a binding") | With a binding recorded, open the popup and click its label. Type a custom name (e.g. "My button") and press Enter. Reopen the popup and press the leader key on the page to check the overlay. | Popup shows "My button" unquoted (not italic) instead of the quoted page text; the which-key overlay shows the same name. Then reopen the popup, click the label again, clear the text entirely, and press Enter - the label reverts to the quoted live page text (or the fingerprint/action if unresolvable), matching #11's fallback behavior. Pressing Escape mid-edit instead discards the in-progress edit and restores whatever was showing before. |
| 24 | **TODO - not currently testable.** Multi-device sync | Sign into the same Chrome profile on a second machine (or a second Chrome profile), record a binding on one, check the popup on the other. | Binding appears after `chrome.storage.sync` propagates (may take a few seconds). Not automatable - needs two real profiles/machines, unavailable in the current test setup. |
