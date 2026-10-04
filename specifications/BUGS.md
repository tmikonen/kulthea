# Kulthea Campaign Chronicles: Development bugs

Bugs found by the product owner while testing. This is not the list of planned work (that is `BACKLOG.md`): it records what went wrong, why, how it was fixed and which test keeps it from coming back.

## Rules

- Each bug has a code `BUG-<n>`, a one-line title, a status, the related backlog item (if any), the description, the root cause, the fix and the verifying test.
- Status is `open` or `fixed`.
- A bug is `fixed` only when a test verifies the fix. The test must have failed before the fix and pass after it, and the row below names it. A fix that is not yet verified by a test stays `open`.
- When a bug is found, add it as `open` with the description. Fill in the cause, the fix and the test when they are known.
- Tests are in `tests/`. Test names are given as the file and the test title.

## Summary

| Code | Title | Status | Item |
|---|---|---|---|
| BUG-1 | Large map is not fitted to the window on load | fixed | B-4 |
| BUG-2 | Map is not refitted when the window is resized | fixed | B-4 |
| BUG-3 | Quick shrink then enlarge of the window loses the refit | fixed | B-4 |
| BUG-4 | The map is not refitted when its area changes size, and the area changes with the event text | fixed | B-15 |
| BUG-5 | The Previous and Next buttons move up when the event has no location line | fixed | B-12 |

## BUG-1: Large map is not fitted to the window on load

- Status: fixed
- Related item: B-4 (FR-1)
- Found: the product owner, in Edge on the desktop.
- Description: the Bay of Izar map (2930 x 1858 px) was shown at its full pixel size, far larger than the window. It could not be zoomed out far enough for the whole image to be visible.
- Root cause: Leaflet limits the zoom that fits an image to the map's minimum zoom, which is 0 by default (the image's native size). A large image needs a negative zoom to fit, so the fitted zoom was clamped to 0. The tests did not notice because the fixture map was only 200 x 100 px, which fits at a positive zoom.
- Fix: the map starts with a very low minimum zoom, so the fit is not clamped. After the fit the component sets the real minimum (the fitted zoom). Commit `6aca125`. The main fixture map was also made 3000 x 1500 px, like the real map, so that the tests cover this case.
- Verified by: `tests/e2e/map.spec.ts`, "FR-1 the main map image is shown, fitted to the area" (failed before the fix with the image 860 px outside the area; passes now). Related: "FR-1 the view cannot be zoomed out past the fitted map or dragged out of view".
- Also confirmed by hand by the product owner.

## BUG-2: Map is not refitted when the window is resized

- Status: fixed
- Related item: B-4 (FR-1)
- Found: the product owner, by resizing a desktop browser window after the page had loaded.
- Description: the map was fitted only on load. Making the window smaller left the map too large for the window. Making it larger left the map small, and it grew only after the map was moved.
- Root cause: two parts. First, on resize the code only updated the zoom limits and never refitted the view. Second, when the code recomputed the fitted zoom, Leaflet clamped the result to the zoom limits set for the previous window size, so a smaller window could not produce a lower fitted zoom.
- Fix: on resize the zoom limits are widened before the fitted zoom is calculated, and the view is refitted when it was still at the fitted zoom. A map the user has zoomed in keeps its zoom. Commit `87f978a`.
- Verified by: `tests/e2e/map.spec.ts`, "FR-1 a map left at the fitted zoom is refitted when the window is resized" (failed before the fix, passes now) and "FR-1 a map the user has zoomed in keeps its zoom when the window is resized".
- Also confirmed by hand by the product owner ("works better", and then fully after BUG-3).

## BUG-3: Quick shrink then enlarge of the window loses the refit

- Status: fixed
- Related item: B-4 (FR-1)
- Found: the product owner, by making the window smaller and then larger again in quick succession.
- Description: only the first resize (the shrink) took effect. The map stayed at the smaller size after the window was enlarged, until the window was resized again.
- Root cause: when the window shrinks and the map has to be zoomed out, Leaflet's `setMinZoom` clamps the zoom with an animated zoom that takes a fraction of a second. While that animation runs, Leaflet silently ignores `fitBounds`, even with `animate: false`. A resize that arrived inside that window was dropped.
- Fix: the view is moved first, while the zoom limits are still wide, and the new limits are set afterwards, so the clamping animation never starts. Commit `e244098`.
- Verified by: `tests/e2e/map.spec.ts`, "FR-1 the map is refitted after the window is dragged smaller and larger again", run with 0, 5, 16 and 40 ms between window sizes. It reproduced the bug before the fix (the final view was too small or larger than the area) and passes now.
- Also confirmed by hand by the product owner.

## BUG-4: The map is not refitted when its area changes size, and the area changes with the event text

- Status: fixed
- Related item: B-15 (FR-1, FR-2); caused by B-10 and B-11
- Found: by Claude, in a browser test written for B-15 that checks that the map is fitted after every step. Not seen by the product owner yet.
- Description: stepping from event to event made the map area change height (for example 539 px, then 504 px, then 539 px, then 562 px), so the map jumped at each step. When the area became shorter, the image was not refitted and ran past the bottom of the area. The same happened when the notice for an unknown event was shown or dismissed.
- Root cause: two parts. First, the event panel below the map had a maximum height but no fixed one, so its height followed the length of the event text, and the map area, which takes the rest of the window, changed with it. Second, the fit code listened only to Leaflet's `resize` event, which Leaflet fires for window resizes. A layout change around the map did not refit it. The earlier tests all used one window size and the same panel contents, so they did not notice.
- Fix: the map watches the size of its own container with a `ResizeObserver` and lets Leaflet recompute its size, which refits the image through the existing `resize` handler. The event panel also has a fixed height (30% of the window, with its own scrolling), so the map keeps its size as the text changes.
- Verified by: `tests/e2e/map.spec.ts`, "FR-1 the map is refitted when its area changes size without the window resizing" and "FR-2 the map area keeps its size while stepping between events with short and long texts" (both failed before the fix and pass now), and "FR-1 stepping through the events shows each one on its own map, fitted to the window", which found it.

## BUG-5: The Previous and Next buttons move up when the event has no location line

- Status: fixed
- Related item: B-12 (the buttons), B-11 (the panel)
- Found: the product owner, when testing Milestone 1.
- Description: the buttons in the event panel are placed after the last line of the event's details. When an event has no location line (an event at a one-off position has no named place), the buttons move up by one line, so their place on the screen changes from event to event. While stepping through the events the buttons should stay where they are, so that the user can click Next repeatedly without moving the pointer.
- Root cause: the location line is drawn only when the event has a named location, and the buttons follow it in the normal flow of the panel, so the panel's lines above the buttons change in number from event to event. Confirmed: a browser test that compares the buttons' positions over all the fixture events failed before the fix.
- Fix: the buttons have a row of their own at the top of the panel, above the details. The title, date, location, note and text are in a scrolling area below the row, so a long text scrolls under the buttons and they stay in view.
- Verified by: `tests/e2e/events.spec.ts`, "FR-2 the buttons stay in the same place for every event, with or without a location line", "FR-2 the buttons do not move while stepping, so Next can be clicked again and again", "FR-2 the buttons stay in the same place in English, with the note for a missing translation" and "FR-2 a long text scrolls under the buttons, which stay in view" (all failed before the fix and pass now).
- Also confirmed by hand by the product owner.
