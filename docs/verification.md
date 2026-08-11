# Verification

Manual test flows for Warpkey. There's no automated coverage yet - MV3
content-script/DOM interaction can't be exercised without a browser, and
there's no unit test runner set up either (see the TODO in `CLAUDE.md`).
Each flow references the `docs/design.md` section it's checking.

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

Flows 1-2 and 5-8 use the fixture's counter-driven targets, which double as a
regression check for fingerprint digit-normalization: the recording click
itself bumps the counter (e.g. "clicks: 0" → "clicks: 1") after the
fingerprint was captured, so the first fire afterward would show a mismatch
if digit runs weren't normalized away. A "looks stale" result on the first
fire means that normalization regressed - see "Selector drift safety" in
`docs/design.md`. Flows 15-16 test the same mechanism from the other side: a
trusted-tier match (`id`/`testId`) should survive a real text change without
going stale, while a weak-tier (`structural`) match still should.

| # | Competency (design.md ref) | Steps | Expected result |
|---|---|---|---|
| 1 | Core record → fire loop via the popup ("Recording", "Key model") | On the fixture page: open popup → **Record** → click the **TestID-tier button** → press `x`. Then press `` ` `` then `x` anywhere on the page. | Popup shows the new binding. `` ` x `` increments the testid counter - same as clicking it directly, not flagged as stale. |
| 2 | Core record → fire loop via leader+r, without opening the popup ("Recording", "Key model") | On the fixture page, with the popup closed: press `` ` `` then `r` directly on the page → click the **Aria-tier target** → press `z`. Then press `` ` `` then `z`. | Recording arms exactly as the popup's Record button would (same "click the thing…" overlay) and the binding fires - confirms leader+r is a real substitute for the popup button, not just a popup-only feature. |
| 3 | Editable-field guard ("Key model") | Click into the fixture's text input, type a sentence containing a backtick, e.g. `` the `quick` fox ``. | Both backticks are inserted as literal characters - leader mode never arms, typing is uninterrupted. |
| 4 | Leader arms even with zero site bindings, and shows only the built-in ("Key model") | On a fresh hostname with zero recorded bindings, press `` ` ``. | The which-key overlay appears showing a single row - `r → Record new binding` - and no divider (nothing below it to separate from). This used to no-op entirely; it doesn't anymore, since the built-in row is always available. |
| 5 | Selector fallback - id tier ("Selector strategy") | Record a binding on the **ID-tier button** (`x` counter). Fire it after a page reload. | Fires correctly; recorded selector has `id` set and no `testId`. |
| 6 | Selector fallback - aria tier ("Selector strategy") | Record a binding on the **Aria-tier target** (`div[role=button]`). Fire it after a page reload. | Fires correctly; recorded selector has `ariaRole`/`ariaName` set, no `id`/`testId`. |
| 7 | Selector fallback - structural tier ("Selector strategy") | Record a binding on the **Structural-tier target** (the plain `<span>`). Fire it after a page reload. | Fires correctly via `structuralPath` alone - the weakest tier, worth confirming it isn't silently broken. |
| 8 | Selector fallback - testid tier ("Selector strategy") | Record a binding on the **TestID-tier button** (as in #1). Confirm via devtools console (`chrome.storage.sync.get('warpkey:hosts', console.log)`) that the saved selector has `testId` populated. | Binding's stored selector has `testId` set; firing still works after a page reload. |
| 9 | Action-type inference ("Recording") | Record a binding on the **focus-target** `<input>`. Click elsewhere to blur it, then fire the binding. | The input receives focus (cursor appears in it) - not a click. |
| 10 | Recording a link doesn't navigate ("Recording") | Open popup → **Record** → click the **Navigation-tier link** (bottom of the page, links to `example.com`) → press `y`. | The page stays on `fixture.html` - no navigation at any point during recording. Firing `` ` y `` afterward *does* navigate - that's the bound action actually running, not a recording side effect. |
| 11 | Reserved key rejected when recording ("Recording") | Open popup → **Record** → click any target → press `r` (or `R`). | Overlay says the key is reserved for the built-in leader+r shortcut and keeps listening - it doesn't cancel or crash. Press a different key, e.g. `q`; the binding completes normally. Escape still cancels from this state too. |
| 12 | Duplicate binding key rejected when recording ("Recording") | Record a binding on key `x` (any target, "any path" scope). Open popup → **Record** again → click a *different* target → press `x`. | Overlay says `x` is already bound to the first target (naming it or its action) and keeps listening - it doesn't cancel or crash. Press a different key, e.g. `w`; that binding completes normally. Escape still cancels from this state too. |
| 13 | Duplicate rejection ignores path scope (edge case, "Recording") | Using the `x` binding from #12, scope it to one path segment via the popup's chips (e.g. `/some/path`, not "any path"). Navigate to an unrelated path on the same host, then Record → click any target there → press `x`. | Still rejected with the same "already bound" message, even though the existing `x` binding no longer matches the current path. A fresh binding always starts unscoped, so it would collide with any existing same-key binding regardless of that binding's current scope - see "Recording" in `docs/design.md`. |
| 14 | Built-in leader+r binding can't be removed or renamed ("Key model", "Storage") | Open the popup and look at the "Global" row (`r → Record new binding`), above the per-site bindings list. | No ✕ remove control and no click-to-rename, unlike every row below it. It isn't stored in `chrome.storage` (see `RECORD_KEY` in `src/shared/constants.ts`), so there's nothing to delete - leader+r keeps working even after deleting every other binding on the site. |
| 15 | Selector drift on a trusted tier (`id`) doesn't misfire as stale ("Selector drift safety") | Record a binding on the **ID-tier button**. In devtools console: `document.getElementById('warpkey-id-button').firstChild.textContent = 'Changed!'`. Fire the binding. | Fires normally - counter increments - with **no** stale warning. An `id`/`testId` match identifies the same element independent of its text. |
| 16 | Selector drift on a weak tier (`structural`) still trips the stale warning ("Selector drift safety") | Record a binding on the **Structural-tier target**. In devtools console: `document.querySelector("[onclick*='structural']").firstChild.textContent = "Renamed target - clicks: "`. Fire the binding. | Overlay shows "looks stale - re-record it?"; the click handler does **not** run. A `structural`-tier match isn't independently confirmed, so a real label change still blocks the action. |
| 17 | Popup and overlay labels reflect live state, read as quoted page text ("Display labels") | Record a binding on the **TestID-tier button**, fire it a couple more times, then reopen the popup and separately press the leader key alone to check the overlay. | Both the popup's binding row and the overlay's list show the button's current text in curly quotes and italics (e.g. `"TestID-tier button - clicks: 2"`), not the frozen record-time text, and not a bare number that could read as a Warpkey-native usage count. |
| 18 | Escape cancels an armed chord ("Key model") | Press `` ` ``, then press `Escape`. | Overlay disappears immediately, no action fires. |
| 19 | leader+leader no longer opens anything ("Key model") | On a site with nothing recorded on the leader key itself, press `` ` `` twice in a row. | The which-key overlay flashes and clears normally on the second press (matched as "no binding on this key" and disarmed) - the extension popup does **not** open. This chord existed briefly and was deliberately removed (see "Key model" in `docs/design.md`); if regression-testing an older build, this is the flow that would show it coming back. |
| 20 | Divider separates the built-in from site bindings ("Key model") | With at least one binding recorded on the current site, press `` ` ``. | A horizontal divider appears between the `r → Record new binding` row and the first site-binding row. (Flow #4 confirms no divider is drawn when there's nothing to separate it from.) |
| 21 | Leader overlay + timeout ("Key model") | With at least one binding recorded, press `` ` `` and wait ~2s without pressing another key. | The overlay appears listing the built-in plus site bindings, then disappears on its own after ~1.5s. |
| 22 | Recording: Escape cancels while waiting for the target click ("Recording") | Open popup → **Record** → before clicking anything, press `Escape`. | Overlay hides immediately; the next click on the page behaves normally (isn't captured as a recording target); popup confirms no new binding was added. |
| 23 | Recording: Escape cancels while waiting for the key ("Recording") | Open popup → **Record** → click any target → press `Escape` instead of a key. | Overlay hides; popup shows no new binding was added. |
| 24 | Bind confirmation message ("Recording") | Open popup → **Record** → click any target → press a key to bind it. | The bottom-right overlay shows a confirmation naming both the key and the target, e.g. `Warpkey: bound "x" to "TestID-tier button - clicks: 0"`, staying visible for ~1.8s before clearing on its own. |
| 25 | Recording: key-capture timeout ("Recording") | Open popup → **Record** → click a target → wait 10+ seconds without pressing a key. | The prompt overlay clears itself; no binding is saved (confirm via popup). |
| 26 | Popup delete ("Storage") | With 2+ bindings recorded, delete one via the popup's ✕. | The deleted binding no longer fires; the other still does; popup list updates live. |
| 27 | Leader key is editable, and propagates live everywhere it's shown ("Key model") | In the popup, click the leader-key `kbd` in the header (shows `` ` `` by default), then press a different key, e.g. `j`. No reload needed. Then try `` ` `` then an existing binding's key, and separately `j` then that same key, as two distinct presses. | `` ` `` no longer arms the chord; `j` does. Reopening the popup shows `j` as the current leader key, and the "Global" row's leader `kbd` (next to `r`) also shows `j`, not the old value. |
| 28 | Persists across SPA navigation ("Binding target") | Record a global binding on a real client-routed app (e.g. GitHub's left nav). Navigate to another in-app route without a full page reload. Fire the binding. | Still fires correctly - bindings are hostname-scoped and `location.pathname` is read live at fire time, not cached at page load. |
| 29 | Path-scoped binding via breadcrumb chips ("Binding target") | Record a binding on a multi-segment path (e.g. a GitHub repo's Issues tab, `/owner/repo/issues`). In the popup, click the `repo`-segment chip instead of leaving it on "any path". Navigate to a sibling route under the same `/owner/repo` prefix (e.g. `/owner/repo/pulls`) and fire the binding, then navigate to an unrelated path (e.g. `/owner/other-repo`) and try again. | Fires on `/owner/repo/pulls` (shares the prefix) but not on `/owner/other-repo`. Reopening the popup shows the chosen chip still highlighted. |
| 30 | Clearing scope back to "any path" ("Binding target") | With the scoped binding from #29, reopen the popup and click the **any path** chip. | Binding now fires on both the original and the unrelated path; **any path** shows as active, no chip from #29 remains active. |
| 31 | Renaming a binding, with fallback ("Renaming a binding") | With a binding recorded, open the popup and click its label. Type a custom name (e.g. "My button") and press Enter. Reopen the popup and press the leader key on the page to check the overlay. | Popup shows "My button" unquoted (not italic) instead of the quoted page text; the overlay shows the same name. Clear the name back to empty and press Enter - the label reverts to the quoted live page text (or the fingerprint/action if unresolvable), matching #17's fallback. Escape mid-edit discards the in-progress edit instead. |
| 32 | Popup closes on Escape, and the hint is accurate ("Key model") | Open the popup. Note the "Esc to close" hint, top right. Press `Escape`. | The popup closes - this is native Chrome popup behavior, confirming the hint is telling the truth. |
| 33 | Escape during leader-key capture doesn't close the popup ("Key model") | Open the popup, click the leader-key `kbd` to start capture, then press `Escape`. | The popup stays open - Escape is consumed to cancel the key-capture instead of triggering the native close. Confirms the hint from #32 doesn't overpromise in this one case where Escape means something else. |
| 34 | Extension icon is a placeholder mark, not a blank yellow box (visual check) | Look at Warpkey's card on `chrome://extensions` and the toolbar icon. | Shows a slate square with an amber chevron mark - not a flat yellow square. It's a placeholder; see the icon TODO in `CLAUDE.md` for swapping in real artwork. |
| 35 | **TODO - not currently testable.** Multi-device sync | Sign into the same Chrome profile on a second machine (or a second Chrome profile), record a binding on one, check the popup on the other. | Binding appears after `chrome.storage.sync` propagates (may take a few seconds). Not automatable - needs two real profiles/machines, unavailable in the current test setup. |
