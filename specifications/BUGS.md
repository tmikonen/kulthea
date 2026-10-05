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
| BUG-6 | A regional map's route is broken by events at places that are not on it | fixed | B-17 |
| BUG-7 | Markers and route lines are drawn at wrong places and snap into place when stepping quickly | fixed | B-33 |
| BUG-8 | The whole page shifts sideways, with a scroll bar, while the journal panel slides in | fixed | B-21 |
| BUG-9 | Markers and route lines are misplaced after quick stepping on an iPhone | fixed | B-33 |
| BUG-10 | The map switcher buttons cover the journal panel's heading on a phone | fixed | B-21 |

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

## BUG-6: A regional map's route is broken by events at places that are not on it

- Status: fixed
- Related item: B-17 (FR-5), with the place rule from B-34
- Found: the product owner, when testing B-17 on the Haestra map.
- Description: at the demo event "Takaisin Izarin satamassa" the Haestra map showed only the route Bentara, Suonperä, the ruins, Bentara, Port of Izar. The earlier visit to the Port of Izar was cut off, and Lean, the watchtower and the camp were skipped together with the lines to them, which looks strange.
- Root cause: an event that has no place on a map breaks the route there, so that leaving a detail map such as Bog End ends the visit. Lean, the watchtower and the camp have no position on Haestra, so each of them broke the Haestra route, and Haestra, which shows only the current visit, drew just the last unbroken stretch. The rule is right for a detail map, where an event that is not on it means the party has left. It is wrong for Haestra, which covers the whole region including Bay of Izar: the party has not left Haestra when it is at Lean, the place is only not marked there.
- Fix: a map's `routes` setting has a third value, `overview`: the whole route up to the current event, in which events with no place on the map are skipped and do not break the route. A `newSegment` on a skipped event still ends the route, because the jump comes before it. Haestra is set to `overview` in `content/maps.json` and `campaign/maps.json`. The build accepts the value and rejects any other. At the demo event "Takaisin Izarin satamassa" Haestra now shows one continuous line: Port of Izar, Bentara, Suonperä, the ruins, Bentara, Port of Izar.
- Verified by: `tests/unit/routes.test.ts`, the group "an overview map (BUG-6)" (nine tests, including "FR-5 the Haestra case: ..." and "FR-5 the same events break the route on a map that is not an overview"); `tests/unit/content.test.ts`, "FR-5 accepts the routes setting overview on any map" and the rejection tests for another value; and `tests/e2e/routes.spec.ts`, the group "an overview map (BUG-6)", on a fourth fixture map. They failed before the fix (the unit tests by their results, and the browser site did not build, because the loader rejected the value) and pass now.
- Also confirmed by hand by the product owner.

## BUG-7: Markers and route lines are drawn at wrong places and snap into place when stepping quickly

- Status: fixed
- Related item: B-33 (the animated move to the focused view), B-13, B-14 and B-17 (the markers and lines)
- Found: the product owner, when clicking Next or Previous in quick succession.
- Description: the route lines and the location markers first appear at wrong places. They move with the panning motion, but displaced, and when the motion stops they shift to their correct places.
- Root cause: confirmed by reproduction. The move to the next event is an animated flight, which also changes the zoom on the way. Leaflet draws markers and lines in an SVG layer that is placed relative to the zoom at its last redraw. A marker or line that is added or updated while a flight is in progress is projected at the in-flight zoom, and then the layer's own scaling is applied on top, so it is displaced until the move ends and the layer is redrawn. Quick clicks start the next step while the previous flight is still running. A browser test shows it: with four quick steps a dot was drawn about 285 px from any place, while a single step, which adds its layers before the flight starts, was always right.
- Fix: when the event changes on a map with a focus zoom, a layout effect stops the flight that is running, before the markers and lines are updated in the effects that follow (BUG-9 later changed how it stops it, from `map.stop()` to a reset of the view). Stopping redraws the layers at the zoom that the flight has reached, and the next flight starts from there, so an interrupted move continues smoothly to the new event.
- Verified by: `tests/e2e/focus.spec.ts`, "FR-1 on every frame of the move, also when stepping quickly, markers, dots and lines are where their places are" (it clicks Next four times, 100 ms apart, and checks every animation frame; it failed before the fix with a worst displacement of about 285 px, and passes now), and "FR-1 a single step also keeps everything at its place on every frame".
- Also confirmed by hand by the product owner.

## BUG-8: The whole page shifts sideways, with a scroll bar, while the journal panel slides in

- Status: fixed
- Related item: B-21 (the journal panel)
- Found: the product owner, on opening the journal.
- Description: when the journal opens, the whole page (the header, the map and the event panel) moves sideways, and a horizontal scroll bar appears. Within a second the page settles and the panel is open with the page in a normal position, but the movement is disturbing.
- Root cause: confirmed by reproduction. The panel's slide-in starts with it moved 100% of its width to the right, outside the window, which made the page wider than the window. Moving focus into the panel (B-21) then made the browser scroll the page sideways to bring the panel into view, by 416 px in the test, and the page moved back as the panel slid in.
- Fix: the area that holds the map, the event panel and the journal panel clips what is outside it, so the sliding panel cannot widen the page, and the focus is moved into the panel without scrolling. Each of the two alone was shown not to be enough for the test.
- Verified by: `tests/e2e/journal.spec.ts`, "FR-6 while the panel slides in, the page under it does not move and does not get a horizontal scroll bar (BUG-8)" (it samples every animation frame of the opening: it failed before the fix with a sideways scroll of 416 px, and passes now).
- Also confirmed by hand by the product owner.

## BUG-9: Markers and route lines are misplaced after quick stepping on an iPhone

- Status: fixed
- Related item: B-33 (the animated move to the focused view), B-13, B-14 and B-17 (the markers and lines). The symptoms look like those of BUG-7, which was found and fixed on a desktop browser; it is not known yet whether this is the same cause.
- Found: the product owner, on the deployed site (GitHub Pages) with an iPhone 13 mini, iOS 26.6.2, Safari, in English.
- Description: when the events are stepped quickly, the markers and the route lines are drawn at wrong places. It happens in both directions.
  - Forwards, from the first event quickly to "Demo: The market in Bentara": the current (red) marker is at the far right edge of the map, away from Bentara, and the route lines do not meet the dots they should join (screenshot `po-attachments/IMG_9204.PNG`).
  - Backwards, quickly back to the first event: the red marker is left of the Port of Izar, not on it (screenshot `po-attachments/IMG_9205.PNG`).
- Root cause: confirmed by reproduction in WebKit 26.6, the engine of the phone's Safari, with the iPhone 13 mini profile, and in Chromium. Two things were needed.
  - The map is a narrow, tall window on a phone, and the real Bay of Izar map has a different shape from the one that the tests used (2930 x 1858 against 3000 x 1500). With the real shape, part way through a flight the map's centre is a pixel away from the pixel grid. Leaflet's `map.stop()`, which the fix of BUG-7 used, first sets the zoom again, and that pans the map by that pixel with an animation of a quarter of a second. When the next click came late in a flight (about 300 to 550 ms into the 600 ms move), the animation ended in the middle of the next flight and fired a `moveend`. A `moveend` makes the layer of lines and markers take the view of that moment as its reference without projecting its lines and markers again, and Leaflet projects them again only when a flight ends. So from then on until the end of the flight they were drawn displaced by as much as the map had moved since (up to 33 px in the test, for 95 frames, about 1.5 s, when the clicks were 300 ms apart; backwards stepping was worse). On a slow phone the move is longer, and the displacement shows more.
  - The tests did not show it: they ran at a desktop size, with a map of another shape, and with clicks 100 ms apart. The BUG-7 test failed in WebKit once the shape was right, with the old code.
- Fix: the layout effect that stops a flight before the markers and lines change no longer calls `map.stop()`. It resets the view where the flight has got to (`setView` with `reset: true`), which stops the flight at once, without any animation, and projects every layer again.
- Verified by: `tests/e2e/focus.spec.ts`, "FR-1 on every frame, also when the next click comes 300, 400 and 500 ms into a move, markers, dots and lines are where their places are (BUG-9)". It runs at a phone size on the focus fixtures, whose main map now has the size of the real one and which have a series of short hops, and it runs in Chromium and in WebKit with the iPhone 13 mini profile (`focus-webkit`). It failed before the fix (the worst displacement was about 20 to 33 px) and passes now. The BUG-7 frame tests also run in WebKit now, and they failed with the old code there too. The fix was also checked on the demo content in WebKit with the iPhone profile, stepping every 25 to 525 ms forwards and backwards: before, up to 33 px for up to 16 frames; after, at most 2 px.
- Note: `po-attachments/` is in `.gitignore` on purpose, so the screenshots are only in the product owner's working copy.
- Also confirmed by hand by the product owner, on the deployed site, on the iPhone where it was found.

## BUG-10: The map switcher buttons cover the journal panel's heading on a phone

- Status: fixed
- Related item: B-21 (the journal panel). The phone layout, in which the journal panel covers the screen, is planned in B-29.
- Found: the product owner, on the deployed site (GitHub Pages) with an iPhone 13 mini, iOS 26.6.2, Safari, in English.
- Description: with the journal panel open on a phone, the map switcher buttons ("Bay of Izar", "Bog End", "Haestra") stay drawn over the panel and cover its title bar, so the heading "Journal" is partly hidden (screenshot `po-attachments/IMG_9206.PNG`). The panel is as wide as 90% of the narrow window, so it reaches under the switcher.
- Root cause: confirmed by reproduction, in WebKit with the iPhone 13 mini profile and in Chromium at a phone size. The map switcher buttons, like Leaflet's own zoom buttons, are drawn at a stacking level of 1000, and the journal panel was at 800, so the buttons were drawn over the panel wherever they overlapped it. On a desktop the panel is narrower than the space to the right of the buttons, so they never overlapped, but on a phone the panel is 90% of the width and reaches under them. The tests ran at a desktop size.
- Fix: the journal panel is at stacking level 1100, above the map's controls and still below the image viewer (2000). The map switcher stays under the panel while the panel is open. The phone layout of B-29 may arrange this differently.
- Verified by: `tests/e2e/journal.spec.ts`, "FR-6 on a phone the panel is above the map buttons: nothing of the map is drawn over its heading and its close button (BUG-10)". It opens the panel at a phone size and checks, for the heading, the close button and every map button that is under the panel, that the element at its middle is in the panel. It failed before the fix (the heading was covered by the button "Pääkartta") in Chromium and in WebKit with the iPhone profile (`journal-webkit`), and passes now. A second test, "the close button of the panel can be tapped", guards the other control of the title bar.
- Note: `po-attachments/` is in `.gitignore` on purpose, so the screenshot is only in the product owner's working copy.
- Also confirmed by hand by the product owner, on the deployed site, on the iPhone where it was found.
