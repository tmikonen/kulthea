# Kulthea Campaign Chronicles: Backlog

The work is split into small increments, in implementation order. The ids are stable labels, not positions: the order of the sections below is the implementation order, and it can differ from the order of the ids (for example B-15 comes before B-13 and B-14). Each increment adds one testable piece of functionality. Some code will be revisited when a later item extends it, and that is accepted. Requirement ids (FR-n) refer to `REQUIREMENTS.md`, and section names refer to `DESIGN.md`.

## Status values

| Status | Meaning |
|---|---|
| backlog | Not yet ready for implementation: only outlined, to be refined when its turn comes. |
| defined | Ready for implementation: has acceptance criteria, automated tests and manual checks. |
| in progress | Partially implemented. |
| done | Implemented, all new and existing tests pass, code committed. |
| accepted | The product owner (the DM) has accepted it after the manual check. Only the product owner sets this status. |

## Definition of done

An item is done only when all of these hold:
1. Every acceptance criterion of the item is met.
2. The automated tests for the item are written, and all new and existing tests pass (`npm test`, `npm run typecheck`, `npm run lint`, and `npm run test:e2e` where the item has browser behaviour; `npm run test:all` runs them all).
3. The "how to check by hand" steps work as described.
4. Any difference from `REQUIREMENTS.md` or `DESIGN.md` found while implementing has been written into those documents.
5. The code is committed to `master` with the message `B-<n>: <title>`, and the item's status is updated in this file.

The next item may start once the previous one is done. Problems found at acceptance are fixed within the same item, which goes back to "in progress".

## Notes for all items

- Manual checks use the local dev server: `npm run dev`, then open `http://localhost:5173/kulthea/` (the `/kulthea/` part is the site's base path).
- The app's demo content in `content/` is invented placeholder material on the real maps, to be replaced by the real campaign later. Tests use their own fixtures in `tests/fixtures/` and never depend on the demo content.
- Demo content is written in Finnish (the default language), with English added to some items so that both languages can be checked.

---

## B-1 Project scaffold and test tooling

Status: accepted

Related: DD-1, "Testing approach", "Deployment".

You will see: a page titled "Kulthea Campaign Chronicles" in the browser, and a set of commands that build and test the project.

How to check by hand:
1. In the repository root run `npm install`, then `npm run dev`, and open the dev address. The heading "Kulthea Campaign Chronicles" is shown.
2. Run `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`. All succeed.
3. Run `npm run test:e2e`. The browser smoke test passes.

Acceptance criteria:
- [x] A React, Vite and TypeScript (strict) project is in the repository root, with the existing `content/` and `specifications/` folders untouched.
- [x] The Vite base path is `/kulthea/`, and CSS Modules are usable.
- [x] `package.json` has the scripts `dev`, `build`, `preview`, `test`, `typecheck`, `lint` and `test:e2e`.
- [x] `.gitignore` excludes `node_modules` and the build output.
- [x] Vitest with React Testing Library runs a first component test.
- [x] Playwright runs a smoke test against the built site (via `preview`) and checks the heading.

Automated tests: component test for the heading; Playwright smoke test.

## B-2 Publishing workflow and live site

Status: accepted

Related: "Deployment".

You will see: the same page as B-1, live on the web at `https://tmikonen.github.io/kulthea/`.

Prerequisites (done by the product owner): the GitHub repository exists and has been pushed to, and GitHub Pages is enabled with the source set to "GitHub Actions".

How to check by hand:
1. Push `master`. The "Actions" tab on GitHub shows a successful run.
2. Open `https://tmikonen.github.io/kulthea/`. The heading is shown.
3. (Optional) Make a test fail on purpose in a scratch branch run, and see that no deployment happens.

Acceptance criteria:
- [x] A workflow in `.github/workflows/` runs on every push to `master`: install with `npm ci`, typecheck, lint, unit tests, build, browser tests, then deploy with GitHub's official Pages actions.
- [x] A failing step stops the workflow before deployment.
- [x] The live site shows the page from B-1.
- [x] Content validation, which is part of the build from B-3 on, therefore also runs before every deployment.

Automated tests: none of its own; the workflow runs all existing tests, and the manual check confirms it.

## B-3 Campaign settings and maps content

Status: accepted

Related: "Build and validation", "File formats" (`campaign.json`, `maps.json`), "Validation rules", FR-1, FR-7, FR-9.

You will see: the campaign title and a temporary list of the three maps (name, pixel size) on the page. Editing a content file updates the page, and a mistake produces a clear error.

How to check by hand:
1. Run `npm run dev`. The page shows the campaign title and the maps Bay of Izar, Bog End and Haestra with their sizes.
2. Edit `content/maps.json` so that two maps are `main`. The terminal and the browser show an error naming the problem and the file. Undo it, and the page recovers by itself.
3. Change a map's declared width to a wrong value. An error is shown.

Acceptance criteria:
- [x] A Vite plugin reads `content/campaign.json` and `content/maps.json` and provides them to the app as one data bundle.
- [x] `content/campaign.json` and `content/maps.json` exist with the real data from `DESIGN.md` (three maps with real pixel sizes, the calendar, Finnish and English).
- [x] Errors stop the build and name the file and the problem: not exactly one main map; a declared size that does not match the image; a missing image file; a default language that is not in the language list; a configured language with no era, month names, in-date forms or date format; not five months.
- [x] A map larger than about 10 MB or 5000 px wide, or not JPEG, PNG or WebP, produces a warning, and the build continues.
- [x] In the dev server, saving a content file re-runs the plugin and refreshes the page.
- [x] The content folder is set by the environment variable `CONTENT_DIR` (default `content`), and `npm run test:e2e` builds the site from `tests/fixtures/` with it, so browser tests never use the demo content.

Automated tests: unit tests for each validation rule (valid and invalid fixtures in `tests/fixtures/`); a test that the plugin output matches the fixture content.

## B-4 Show the main map

Status: accepted

Related: DD-2, FR-1, "Positions".

You will see: the Bay of Izar map filling the main area, which you can drag to pan and zoom with the wheel, the +/- buttons or pinch on a touch screen.

How to check by hand:
1. Open the dev address. The Bay of Izar map is shown, fitted to the window.
2. Drag it, zoom with the wheel and the +/- buttons. Zooming in shows the full detail of the image, and you cannot drag the map completely out of view.
3. Resize the window and use the browser's phone view. The map stays usable.

Acceptance criteria:
- [x] The main map is shown with Leaflet using a flat image, fitted to the area on load.
- [x] Pan and zoom work with mouse, wheel, buttons and touch, and the view is limited to the map bounds.
- [x] A single conversion function turns `[x, y]` percent positions into Leaflet coordinates, with y measured from the top.

Automated tests: unit tests for the converter (corners, centre, and that the y axis is inverted correctly); a component test that the map renders; a Playwright test that the map image is visible and the zoom button changes the zoom.

## B-5 Switch between maps

Status: accepted

Related: FR-1, "Data flow" (map loading), DD-4, "Interface texts" (`ui.json`).

You will see: a map switcher at the top left of the map area, listing Bay of Izar, Bog End and Haestra. Choosing one shows that map. The choice is in the web address, so reloading keeps it and the back button goes back.

Scope note: the switcher needs an interface text (its label), and every user-facing text must come from `ui.json`. So this item creates a minimal `ui.json` with one text and reads and validates it through the plugin. B-6 builds on it. Until B-11 the route is `/#/?map=<id>`; B-11 moves it to `/#/event/<id>?map=<id>`.

How to check by hand:
1. Use the map switcher to show each of the three maps.
2. Reload the page. The same map stays selected. Press the browser's back button. The previous map returns.
3. Open the address with `?map=haestra` after the `#/` part. That map opens. Use an unknown map id. The main map opens.
4. In the browser's network view, watch that the main map loads first and the other two download afterwards.
5. Remove the Finnish text from `content/ui.json`. The terminal shows an error naming the file and the key. Undo it.

Acceptance criteria:
- [x] A hash router (React Router) is in place, and the active map is the `map` query parameter; no or an unknown value means the main map.
- [x] The map switcher is at the top left of the map area, shows all maps from `maps.json` by name, marks the active one, and changes the displayed map.
- [x] The other maps are downloaded in the background (with `new Image()`) after the main map is shown.
- [x] Switching maps does not reload the page.
- [x] `content/ui.json` exists with one text, the switcher label (`maps`: "Kartta" / "Map"), and `tests/fixtures/ui.json` likewise.
- [x] The plugin reads `ui.json` into the data bundle. A text without a default-language value, or a missing or invalid `ui.json`, is a build error naming the file and the key.
- [x] The switcher label is shown through the text resolver. B-5 used only the default language, and B-6 added the language selection.

Automated tests: unit tests for reading and validating the `map` parameter; unit tests for the `ui.json` validation (valid, missing file, missing default-language text); a component test for the switcher; Playwright tests for switching, reload and back.

## B-6 Interface languages

Status: accepted

Related: FR-9, DD-5, "Languages", `ui.json`.

Scope note: `ui.json` itself, its reading through the plugin and its default-language validation are done in B-5. This item adds the language selection and extends `ui.json` with the texts it needs.

You will see: a FI | EN switch at the top right of the page (the journal button, added in B-21, will go next to it). Switching changes all interface texts (for example the map switcher label) and the campaign title, without reloading and while keeping the selected map.

How to check by hand:
1. Click FI and EN. The interface texts change, and the map stays the same.
2. Open the address with `?lang=en`. The page opens in English. Use `?lang=xx`, or no value. It opens in Finnish.
3. Check in the browser's developer tools that the page's `lang` attribute follows the chosen language.
4. Remove a Finnish text from `content/ui.json`. The terminal shows an error (already in place from B-5).

Acceptance criteria:
- [x] `ui.json` has the texts this item needs (for example the switch label), each with Finnish and English.
- [x] A text resolver returns a value for the chosen language and falls back to the default language; a plain value means the default language only.
- [x] The `lang` query parameter selects the language (missing or unknown means the default), together with `map`.
- [x] The language switch changes only the `lang` parameter and keeps the other parameters.
- [x] The page's `lang` attribute follows the language.
- [x] A text in `ui.json` that is missing in a non-default language falls back to the default language without an error.

Automated tests: unit tests for the resolver (plain value, language map, fallback, missing) and the `ui.json` fallback; a component test for the switch; Playwright tests that the switch changes text and keeps the map.

## B-7 Locations

Status: accepted

Related: "File formats" (`locations.json`), "Positions", "Validation rules".

You will see: markers on the maps for all locations, at the correct spots, with the location name on hover in the chosen language. (Showing every location is temporary and is replaced by the visited-places rule in B-14.)

How to check by hand:
1. Open the maps. The demo locations are marked on the maps they have positions for, and only there.
2. Hover over a marker. The name is shown, and it changes with the language switch.
3. Put a position of 120 in `content/locations.json`. An error is shown.

Acceptance criteria:
- [x] `content/locations.json` exists with a small demo set (eight locations on the three maps, some on more than one map: Port of Izar, Bentara, Ton-Bor, Bog End, Ancient Jinteni Ruins, Lean, Ruined Watchtower and Troll Cave, with positions chosen by the product owner and read off the map images).
- [x] Each location's positions are percent values from 0 to 100 on a map that exists.
- [x] Errors: duplicate ids, a position on an unknown map, a position outside 0 to 100, a name with no default-language text.
- [x] Names are language maps or plain values, resolved with the resolver from B-6.
- [x] Markers appear at the converted positions on the displayed map.

Automated tests: unit tests for the validation; a test that the markers are placed at the converted positions; a Playwright test that the marker count and the tooltip text match the fixture.

## B-8 Events content

Status: accepted

Related: "File formats" (events), "Data model", "Validation rules", FR-3.

Scope note: only the front matter is read here. The event text (the body of the file) is processed in B-10, and the dates are shown in B-9. The demo events are invented and kept apart from the real campaign events: they all fall in the year TE 6000, their file names contain `demo-`, their titles start with "Demo:", and `content/README.md` says so. The real events are in `campaign/`, which the same reader validates.

You will see: a temporary list under the map with every demo event's title in date order, taken from the files in `content/events/`.

How to check by hand:
1. Open the page. The list shows the demo events in date order.
2. Change the order number in a file name. The order of events on the same day changes accordingly.
3. Rename a file so that the month is 6. An error is shown. Refer to a location that does not exist. An error is shown.

Acceptance criteria:
- [x] The plugin reads the files in `content/events/`, reading the date and order from the file name (`year-month-day-order-slug.md`) and the front matter (`title`, `location`, `showOn`, `track`, `newSegment`).
- [x] Ten demo events exist (their dates already include the days that B-9 needs), with a mix of events on the main map, an event shown on another map, an event with `n/a` on the main map, a split track and a standalone event. The text is Finnish, with English titles on some.
- [x] Events are sorted by year, month, day, then order number.
- [x] Errors: a file name that does not match the pattern, a month outside 1 to 5, a day outside 1 to 70, two events with the same date and order, a missing title, a location id that does not exist or has no position on the map it is used for, `n/a` on the main map with no `showOn`.
- [x] The title is resolved with the language resolver.

Automated tests: unit tests for the file name parser, the sort order and each validation rule; a Playwright test that the list shows the fixture events in the expected order.

## B-11 Event view and routing

Status: accepted

Related: FR-2, FR-3, DD-4, "URLs", "Bad links", "Application architecture" (layout).

Scope note: this item comes before B-9 and B-10, so the panel shows the title and the location now, and B-9 and B-10 add the date and the text to it. The B-7 location markers stay on the map until B-14 replaces them. An unknown event id is replaced in the address by the first event's id, and the notice is kept in the browser's history state, so it does not come back on every reload.

You will see: opening the site goes to the first event, and the address becomes `/#/event/<id>`. Under the map is an event panel with the event's title and its location name. The temporary list is gone. The map and its markers behave as before.

How to check by hand:
1. Open the site. It goes to the first event, with its title and location under the map.
2. Edit the address to another event's id. That event is shown. Edit it to a nonsense id. The first event is shown with a notice, and the notice can be dismissed.
3. Switch the map and the language. The event stays. Reload and press back. The event stays.
4. Open `/#/?map=haestra`. It redirects to the first event with that map.

Acceptance criteria:
- [x] The current event comes only from the URL (`/event/<id>`), with no second copy of that state.
- [x] `/#/` and any other unknown path redirect to the first event, keeping `map` and `lang`.
- [x] An unknown event id redirects to the first event and shows a dismissible notice. The notice and the dismiss button texts come from `ui.json`.
- [x] The event panel shows the title in the chosen language and the location name, falling back to the `showOn` location when the main one is `n/a`. A one-off position shows no location line.
- [x] Switching map or language keeps the event. The temporary list from B-8 is removed. The layout is the map above and the panel below, and the map is still fitted.
- [x] With no events, the map and header still show and there is no panel.

Automated tests: unit tests for finding the current event from an id; component tests for the panel in both languages and for the notice and its dismissal; Playwright tests for opening `./` (redirect), a direct link, an unknown id with the notice, map and language keeping the event, and reload and back. The existing map and location Playwright tests that use `#/?map=...` are updated to the new routes.

## B-12 Stepping through events

Status: accepted

Related: FR-2, DD-4, "Data flow".

Scope note: stepping drops a manual `map` choice, as the design says (a manual switch lasts only until the next step). Until B-15 the displayed map then falls back to the main map. Not included: a position indicator such as "3 / 10", and keeping focus when a button becomes disabled at an end (accessibility is B-30).

You will see: Previous and Next buttons in the event panel. Each click moves one event in date order, the address follows, and the buttons are disabled at the two ends.

How to check by hand:
1. Click Next through all the events, then Previous back. The title and address change each time.
2. Check that Previous is disabled on the first event and Next on the last.
3. Switch the map manually, then click Next. The map returns to its default for the new event.
4. Use Tab and Enter or Space on the buttons. Press the left and right arrow keys with focus in the panel.
5. Press the browser's back button after stepping. It goes to the previous event.

Acceptance criteria:
- [x] Next and Previous move to the neighbouring event in date order and update the URL. Stepping adds a history entry, so back works.
- [x] Previous is disabled at the first event and Next at the last.
- [x] Stepping removes a manual `map` choice and keeps `lang`.
- [x] The buttons work with Tab, Enter and Space. The left and right arrow keys step while focus is in the event panel, but not on the map, so they do not clash with the map's own panning.
- [x] The button texts come from `ui.json`.

Automated tests: unit tests for finding the previous and next ids (none at the ends); component tests for the disabled states and for stepping keeping `lang` and dropping `map`; Playwright tests for stepping through every fixture event with the URL and title following, the disabled ends, back, and keyboard operation.

## B-9 Calendar and dates

Status: accepted

Related: FR-7, "File formats" (`campaign.json` dates), "Languages".

Depends on: B-11 and B-12 (the event panel and stepping). Do not start before they are done.

You will see: the current event's date in the event panel, written in full in the chosen language: "K.A. 6050, Talven 37. päivä" in Finnish and "TE 6050, 37th of Winter" in English.

How to check by hand:
1. Open the page and look at the date in the event panel.
2. Switch between FI and EN. The date changes format and month form.
3. Step to events on the 1st, 2nd, 3rd, 11th, 12th, 13th, 21st and 70th day. The English endings are 1st, 2nd, 3rd, 11th, 12th, 13th, 21st and 70th.

Acceptance criteria:
- [x] A date formatter builds a date from the campaign settings: `{era}`, `{year}`, `{month}` (the in-date form), `{day}` and the English `{ordinal}`, which is empty in Finnish.
- [x] The Finnish month forms are Talven, Kevään, Kesän, Ruskan and Martaan, and the English ones are Winter, Spring, Summer, Autumn and Fall.
- [x] The date in the event panel uses the formatter and follows the chosen language.
- [x] The demo events include dates on days 1, 2, 3, 11, 12, 13, 21 and 70, so the English endings can be checked by hand (the B-8 demo events already have them, so only adjust if needed).

Automated tests: unit tests for the formatter in both languages for all five months, days 1 to 70 and the ordinal edge cases; a Playwright test for the two formats.

## B-10 Event text and language sections

Status: accepted

Related: FR-3, FR-9, DD-5, "Languages", "Validation rules" (languages, raw HTML).

Depends on: B-11 and B-12 (the event panel and stepping). Do not start before they are done.

You will see: the event panel shows the text of the current event, in the chosen language. An event with no English text shows the Finnish text with a small note when English is chosen.

How to check by hand:
1. Step to an event that has both languages. Switch language. The text changes.
2. Step to an event that is only in Finnish and choose English. The Finnish text is shown with the note "Not available in this language".
3. Add raw HTML (for example `<b>`) to an event file. An error is shown.
4. Add an `@de` section. An error is shown for an unconfigured language.

Acceptance criteria:
- [x] The event body is split into language sections by marker lines (`@fi`, `@en`); text with no marker is the default language.
- [x] The Markdown is rendered to HTML at build time, and raw HTML is not allowed.
- [x] The text is taken in the chosen language, falling back to the default language together with the "not available in this language" note (from `ui.json`).
- [x] Links (`[[...]]`), images and `:::journal` blocks are not interpreted yet: they are added in B-23, B-27 and B-26, so the demo event texts contain none of them until then.
- [x] Errors: an unconfigured language, a repeated section for the same language, no default-language text, unmarked text together with an explicit default-language section, raw HTML.

Automated tests: unit tests for the section splitter, the language rules and the HTML check; component tests for the fallback note; a Playwright test for the language switch on event text.

## B-15 Events on another map

Status: accepted

Related: FR-1, FR-3, DD-3, "Data flow" (step 5), "Map switching".

Depends on: B-12 (stepping).

Scope note: while testing this item a defect from B-10 and B-11 was found and fixed (BUG-4 in `BUGS.md`): the map area changed size with the event text and the map was not refitted. The map now follows the size of its own area, and the event panel has a fixed height. This item comes before B-13 and B-14, because it fixes the displayed map that they draw on. The displayed map is the `map` URL parameter when it names a map, otherwise the map of the event's `showOn`, otherwise the main map. This changes the rule from B-5, where a missing or unknown `map` meant the main map: it now means "the event's own map". B-12 already drops a manual `map` choice when stepping, so after this item stepping always shows the new event on its own map. The B-7 location markers stay as they are, and the event's own marker comes in B-13.

You will see: stepping to an event that is shown on another map switches the map by itself, and stepping on to an event on the main map switches back. A choice made with the map switcher lasts until the next step. Opening a link to such an event opens that map.

How to check by hand (with the demo content):
1. Step through the demo events (there were ten when this item was done, and B-17 added three). Event 6 ("Saapuminen Suonperään") shows the Bog End map, and event 7 ("Tiedustelijat raunioilla") and the next, "Seurue raunioilla", stay on it. "Ryhmät yhdistyvät" is back on Bay of Izar, "Keksityn hahmon synnyinpaikka" shows Haestra, and "Takaisin Izarin satamassa" and "Teleporttaus Ton-Boriin" are on Bay of Izar.
2. Switch to another map with the switcher, then press Next. The map follows the next event, not your choice. The event itself never changes when you switch maps.
3. Open the address of event 6 directly. Bog End opens. Add `?map=haestra`. Haestra opens, with the same event. Reload. It stays.
4. Add `?map=nowhere`. The event's own map opens.

Acceptance criteria:
- [x] One function gives the displayed map from the maps, the `map` parameter and the current event, with the rule above.
- [x] The map switcher marks the displayed map, and choosing a map keeps the event.
- [x] Stepping to an event with `showOn` shows that map, and stepping on to an event without it shows the main map. Stepping back works the same way.
- [x] After a manual map choice, stepping shows the next event on its own map.
- [x] The `map` parameter wins over the event's own map, and an unknown one is ignored.
- [x] The shown map starts fitted to the window after an automatic switch, and the maps are still downloaded in the background.

Automated tests: unit tests for the displayed-map function (known, unknown and missing `map`; with and without `showOn`); component tests for the switcher marking the displayed map; Playwright tests that step through the fixture events and check the map each time, a manual choice followed by a step, a direct link, a link with `map`, an unknown `map`, and reload. The B-5 tests that say an unknown `map` means the main map are updated.

## B-13 Current event marker

Status: accepted

Related: FR-1, FR-2, FR-3, FR-8, "Map markers".

Depends on: B-15 (the displayed map).

Scope note: an event has at most two places, its main-map place and, when it has `showOn`, its place on one other map. The event's place on a map is: on the main map its main place (none for `n/a`), on the `showOn` map its `showOn` place, and on any other map none. A named location that merely has a position on another map did not give the event a place there. B-34 later changed this: a named location also gives the event a place on any other map where it has a position. The B-7 markers for all locations stay until B-14, and the current marker is drawn above them.

You will see: a large marker on the map at the current event's place. It moves as you step. A standalone event has one too. An event shown on another map has its marker on that map. When you have zoomed in and the marker is outside the visible area, the map pans to it, and the zoom does not change.

How to check by hand (with the demo content):
1. Open the first event. The marker is at the Port of Izar. Step on. It moves to each event's place, including the one-off camp position and the places on Bog End and Haestra.
2. Zoom in on a corner of the map and step to an event that is somewhere else on it. The map moves so that the marker is in view, with the same zoom. Step to an event whose marker is already visible. The map stays still.
3. Switch with the map switcher to a map that the event is not on. There is no current marker there, and the event does not change.
4. Hover over the marker. The location's name is shown, if it has one.

Acceptance criteria:
- [x] One function gives an event's place on a given map, with the rule in the scope note.
- [x] The marker is at the converted position of that place on the displayed map, follows stepping, and does not change with the language.
- [x] The marker is clearly larger and a different colour from the other markers, and is drawn above them. Its hover text is the location's name where it has one.
- [x] No marker is shown when the event has no place on the displayed map.
- [x] When the marker is outside the visible area, the view pans to it with a short animation. The zoom is not changed, the view does not move when the marker is already inside it, and nothing happens at the fitted zoom.
- [x] Fitting and refitting the map still work: the tests for BUG-1, BUG-2 and BUG-3 still pass.

Automated tests: unit tests for the place function (main, `showOn`, `n/a`, one-off, another map) and for deciding whether the view has to move; component tests for the marker's presence; Playwright tests that the marker's position in percent matches the event at every step of the fixtures (main map, second map, one-off), that zooming in and stepping brings the marker into view with the same zoom, and that it does not move the view when the marker is visible.

## B-14 Places visited so far

Status: accepted

Related: FR-1, FR-8, "Map markers".

Depends on: B-13 (an event's place on a map and the current marker).

Scope note: this item replaces the B-7 markers for all locations, so the map now shows only where the story has been. The dots on a map are the places of the earlier events, in date order, that have a place on that map (the rule from B-13). Standalone events count. A place that was visited several times is one dot, and a place that is the current marker has no dot. Locations that have a position on a map but were not visited are not shown. A named place visited by an event on one map was not shown on another map where it also happens to have a position. B-34 later changed this: it is shown there too.

You will see: at the first event there is only the current marker. Each step adds a small dot for the place you came from, and stepping back takes dots away. Several events at one place make one dot.

How to check by hand (with the demo content, then with `CONTENT_DIR=campaign`):
1. Open the first event. Only its marker is shown. Step forward. Dots accumulate behind the marker.
2. Step back. The dots go away in the same order.
3. In the real events, the two events at the Troll Cave make one dot.
4. Open an event on Bog End. Its map shows only the dots for earlier events that were on Bog End. Switch to Bay of Izar. The dots there are those of earlier events on the main map.
5. Hover over a dot. A named place shows its name.

Acceptance criteria:
- [x] The dots on a map are computed from the events before the current one, so they are the same however you arrived at an event.
- [x] The B-7 markers for all locations are gone, and no place the story has not reached is shown.
- [x] A place visited by several events is one dot, a place at the current marker has no dot, and standalone events have dots.
- [x] Dots are small and clearly different from the current marker. A named place shows its name on hover, and a one-off position shows nothing.
- [x] A manual map switch shows the dots of the earlier events that have a place on that map.

Automated tests: unit tests for the visited-places function (order, repeats, standalone, one-off positions, the current place, other maps); component and Playwright tests that replace the B-7 marker tests: dots and marker positions at each step of the fixtures, dots disappearing when stepping back, hover names. The B-7 acceptance stays as it was, since its marker positions are still tested.

## B-33 Focused view per map

Status: accepted

Related: FR-1, FR-2, DD-2, "Map markers", "File formats" (`maps.json`).

Depends on: B-13 (the current marker and the view following it) and B-15 (the displayed map). It belongs to Milestone 1 and was added after the first test of B-15, B-13 and B-14.

Scope note: a map can be set to show an event in a focused, zoomed-in view, so that stepping gives more focus and a sense of movement. The setting is `focusZoom` in `maps.json`: a number of zoom-in steps from the fitted view, like pressing the + button that many times. With the present step of half a zoom level, 2 steps double the size of the fitted view, and the value can be tuned. A map with no `focusZoom`, or with 0, shows the whole map as before. Bay of Izar gets 2, and Haestra and Bog End get none. The choices made with the product owner:
- the view is focused on every step to an event, and also when the map is switched automatically or the event is opened from an address. The user's own zooming and panning last only until the next step, as a manual map choice does;
- when the map is switched manually to a map that has a focus zoom, the view is focused if the current event has a place on it, and shows the whole map if it has not;
- when the event stays on the same map, the view zooms and pans smoothly (about 0.6 s). When the map itself changes, the new map starts already focused, with no animation;
- a window resize keeps the zoom, as it does when the user has zoomed in;
- a map with no focus zoom keeps the behaviour from B-13: the view pans only when the marker is outside it.

You will see: on Bay of Izar, stepping to an event zooms in around its marker, and stepping to the next event glides to the next place. On Bog End and Haestra the whole map stays in view.

How to check by hand (with the demo content, then with `CONTENT_DIR=campaign`):
1. Step through the events on Bay of Izar. Each one is zoomed in around its marker, and moving to the next place glides there. Step to the Bog End and Haestra events. The whole map is shown. Step back to Bay of Izar. It is zoomed in again.
2. Zoom out or in by hand, then step. The next event is shown in the focused view again.
3. Switch to Bay of Izar with the map switcher at an event that is placed there. The view is focused. Do it at an event that is not placed there. The whole map is shown.
4. Make the window larger and smaller while zoomed in. The zoom stays.
5. In `content/maps.json` change `focusZoom` to 4. The zoom is stronger. Remove it. The whole map is shown. Set it to -1 or to text. The build reports an error that names the file and the map.

Acceptance criteria:
- [x] A map in `maps.json` may have `focusZoom`, a number of at least 0. The build rejects another value with an error that names the file and the map. An omitted value means 0.
- [x] When the displayed map has a focus zoom above 0 and the current event has a place on it, the view is centred on the marker, at the fitted zoom plus that many zoom steps, and not beyond the map's maximum zoom. This holds on every step, when the map is switched automatically or manually, and when an event is opened from an address or after a reload.
- [x] When the event stays on the same map, the view moves with a smooth animation of about 0.6 s. When the map changes, the new map starts focused, with no animation.
- [x] When the event has no place on the displayed map, the whole map is shown.
- [x] A map with no focus zoom behaves as in B-13. The user can still zoom out to the whole map, and a window resize keeps the zoom.
- [x] The tests for BUG-1 to BUG-4 (fitting and refitting) still pass.
- [x] `content/maps.json` and `campaign/maps.json` give Bay of Izar `focusZoom: 2`, and Haestra and Bog End none. The focus tests run on a site of their own, built from `tests/fixtures-focus/` (the main map has a focus zoom there, and the second map has none), so the earlier tests on `tests/fixtures/` stay valid.

Automated tests: unit tests for the validation (valid, 0, negative, text, omitted) and for the zoom worked out from the fitted zoom, the steps and the maximum; Playwright tests, on the `tests/fixtures-focus/` site, that stepping focuses and centres the marker, that stepping again returns to the focused view after the user has zoomed, that a map without a focus zoom is unchanged, that a manual switch focuses only when the event has a place there, that the first view after an address or a reload is focused, and that a window resize keeps the zoom.

### Milestone 1: the map follows the story (after B-14 and B-33)

A checkpoint for a longer manual test, with your feedback before the routes start. Stepping through the events, the map switches itself, the marker moves, the view follows it, and the trail of visited places grows.

What to try: step through all the demo events and through the five real events (`CONTENT_DIR=campaign npm run dev`), forwards and backwards, with and without zooming in, switching maps by hand in between, and opening addresses directly.

Feedback wanted:
- the look and size of the marker and the dots;
- whether the map moving to the marker feels right, or should be more or less eager, and how the focused view on Bay of Izar (B-33) feels;
- whether the rule that an event only has places on its own maps is what you want. (This was changed in B-34: a visited place is also shown on every map where its location has a position.)

## B-34 Places on every map

Status: done

Related: FR-1, FR-3, FR-5, DD-3, "Map markers", "Validation rules".

Depends on: B-33 (the end of Milestone 1). It revises the place rule of B-13 and B-14, which are accepted, and it comes before the route items because they use the same rule.

Scope note: after testing Milestone 1 the product owner decided that a place visited anywhere is shown on every map where its location has a position, so that the positions in `locations.json` are used. The rule for an event's place on a map `M` is now:
1. On the main map: the event's main place, its `location` or `position`. `n/a` means none, and it is respected.
2. On the `showOn` map: the `showOn` place, its `location` or `position`.
3. On any other map: the first of the event's named locations (`location`, then `showOn.location`) that has a position on `M`, or none. A one-off position never counts on another map.

An explicit place always wins over a position taken from a location. The current marker, the dots for visited places and, from B-16, the routes all use this one rule. So a visit to Suonperä appears on Bay of Izar and on Haestra too, and an event at the Port of Izar has a marker on Haestra when Haestra is viewed. An event that is `n/a` on the main map still has no place there, so `n/a` should be used only for events outside the main map's region (such as the Haestra backgrounds). An event inside it gets a main location, and `showOn` chooses the map it is displayed on. To help with that the build warns when an event is `n/a` on the main map but its `showOn` location has a main-map position. The demo event 6 (Bog End) is changed from `n/a` to the main location Suonperä, and the `n/a` demo case stays with event 9. This closes the open question about locations on several maps.

You will see: on Bay of Izar, the dots and the marker for places the story visited on Bog End, such as Suonperä. When you switch by hand to a map that the current event is not placed on, its marker is shown if the event's location has a position there.

How to check by hand (with the demo content):
1. Step to event 6 (Suonperä, shown on Bog End). Switch to Bay of Izar and to Haestra. The marker is at Suonperä on both.
2. Step on to event 7, the ruins. On Bay of Izar the dot for Suonperä is there, and the marker is at the ruins.
3. Switch to Haestra at event 1 (Port of Izar). The marker is at the Port of Izar.
4. At "Keksityn hahmon synnyinpaikka", which is `n/a` on the main map and shown on Haestra, Bay of Izar has no marker for it.
5. In `content/events` set an event to `location: n/a` with a `showOn` location that has a main position. The build warns and names the file and the location. The build still works.

Acceptance criteria:
- [x] One function gives an event's place on a map by the three rules above, and the current marker and the dots both use it.
- [x] An explicit place wins over a place taken from a location, `n/a` on the main map is respected, and a one-off position gives a place only on its own map.
- [x] The build warns, and does not fail, when an event is `n/a` on the main map and its `showOn` location has a main-map position. The warning names the file and the location. The real events and the demo events give no warning.
- [x] The demo event 6 has the main location Suonperä. The tests of B-13 and B-14 that depended on the old rule are updated.
- [x] The documents give the new rule, and the open question is removed from this file (done when the item was defined).

Automated tests: unit tests for the place function (each rule, the precedence, `n/a`, one-off positions, a location with no position on the map) and for the warning (given, not given, several events, the build continues); the B-13 and B-14 unit, component and Playwright tests are updated to the new rule. In the fixtures, the event at `both-places` now has a marker at its second-map position when the second map is viewed.

## B-16 Party route logic

Status: done

Related: FR-5, FR-8, DD-3, "Data flow" (routes), "Shared logic without UI".

Depends on: B-34 (an event's place on a map).

Scope note: a plain function, worked out once at load, that turns the events in date order into route segments per map, a second one that clips them to the events up to the current one, and a third that says which lines to show on a map for the current event. It has no screen of its own, so this item is accepted together with B-17. It covers the party track (events with no `track`), the places of B-34, standalone events (`track: none`, ignored), the breaks where an event has no place on the map, one segment for each visit to another map, and `newSegment`. The lines to show follow the product owner's rule: on the main map the whole route up to the current event stays, and on any other map only the current visit of each track is shown, that is, the route of a track begins when it enters the map and is no longer shown once it has left, while the visited places stay as dots. Whether a map keeps its whole history, only the current visit, or (BUG-6) the whole route with unmarked places skipped is a setting of the map (`routes`, B-17). Events of named groups are ignored here, and B-18 adds them. There is no debug view, since B-17 draws the routes straight away.

You will see: nothing new on the screen yet. The behaviour is defined by the worked examples below, which become the unit tests word for word, and which I would like you to read and confirm.

Worked examples (A, B, C, D are party events on the main map, in date order). A map that an example names is the only map where the event has a place, unless the example says otherwise, so an event "on the main map" is at a place with no position on Bog End:
1. A, B, C, D give one line A-B-C-D. One event alone gives no line.
2. A, B, S, C, where S is a standalone event, give A-B-C. The standalone event neither adds a line nor breaks the route.
3. A, B, N, C, D, where N has `n/a` on the main map and is shown on Bog End: on the main map there are two lines, A-B and C-D, because N has no place there and breaks the route. On Bog End N is alone, so it has no line.
4. A, X, Y, B, where X and Y have a main location and are also shown on Bog End: on the main map A-X-Y-B is one line, because they still have main-map places. On Bog End X-Y is a line of its own.
5. N1, N2, A, N3, where N1, N2 and N3 are only on Bog End and A is only on the main map (at a place with no position on Bog End): on Bog End N1-N2 is one line and N3 is alone. Each separate visit to another map is its own segment.
6. A, B with `newSegment`, C give A alone, then B-C. There is no line from A to B on any map where both have a place.
7. Two events at the same position in a row give no zero-length line, and the route goes on from that point.
8. Events of a named group between A and B do not change the party's line A-B.
9. Clipping: with the current event C in A-B-C-D, the line is A-B-C. With the current event B it is A-B.
10. A place from a location: an event E at Suonperä, with no `showOn`, has a place on Bog End as well as on the main map, because the location has a position on both. Consecutive party events at places with a Bog End position are one visit there.
11. A visit map shows only the current visit. A, S1, S2, S3, B, S4, where S1 to S4 are at places on Bog End and A and B are only on the main map (at places with no position on Bog End). On Bog End, at S3 the line is S1-S2-S3. At B the party has left, so there is no line, and S1, S2 and S3 stay as dots. At S4 the line is S4 alone, with no line from the earlier visit.
12. Tracks are separate: the party is on Bog End (P1, P2) and the current event is an event of a group on the main map. Bog End still shows the party's line P1-P2, because the party's latest event is on Bog End, and shows no line for the group.
13. A history map shows everything: on the main map at S4 in example 11, the lines of the whole route up to S4 are shown, however many times the party has been to Bog End.
14. An overview map skips events at places that are not on it (BUG-6): S1, U, S2, where U has no place on the map, give S1-S2 on an overview map, and S1 and S2 apart on any other map.
15. A new segment on a skipped event still ends the route on an overview map, because the jump comes before it.

How to check by hand: read the worked examples and tell me if any is not how you want routes to behave. Run `npm test` to see them pass.

Acceptance criteria:
- [x] A route function returns the segments per map for the party track, with each point tied to its event, following the worked examples above.
- [x] A second function clips the segments to the events up to a given event in date order, so stepping needs no recomputation. A third gives the lines to show on a map for the current event: all the clipped segments on a history map, and on a visit map for each track only the clipped segment that holds the track's latest event up to the current one, if that event has a place on the map.
- [x] Standalone events and named-group events are ignored, an event with no place on a map breaks the route there, and `newSegment` starts a new segment on every map.
- [x] Every worked example is a unit test, with the event order and places written out as in the example.

Automated tests: the unit tests of the worked examples, plus tests that a segment never holds an event twice, that the points are in date order, and that clipping at any event keeps exactly the earlier part.

## B-17 Drawing the party route

Status: done

Related: FR-5.

Depends on: B-16 (the route logic) and B-14 (the dots and marker that the line goes under).

Scope note: a map gets a setting `routes` in `maps.json`, `"history"`, `"visit"` or (added for BUG-6) `"overview"`: a history map keeps the whole route up to the current event, a visit map shows only the current visit of each track, and an overview map keeps the whole route but skips events at places that are not on the map instead of breaking the route, which is right for a map that covers the whole region, such as Haestra. The main map is `history` and every other map is `visit` unless the setting says otherwise, and Haestra is set to `overview`. The demo events are extended where the routes need it, and that is done: a party event after the standalone event, "Takaisin Izarin satamassa" (11); a party event after the new segment, "Ton-Borin portilla" (13); and a second party event on Bog End, "Seurue raunioilla" (8), so that a visit has a line. The extra fixture events for the route tests are in a set of their own, `tests/fixtures-routes/`, built into a third test site, so that the other browser tests keep their fixtures. Only invented events are changed, never the real campaign. The demo events are now 1 "Lähtö Izarin satamasta", 2 Lean, 3 the watchtower, 4 the camp, 5 the market in Bentara, 6 "Saapuminen Suonperään", 7 "Tiedustelijat raunioilla" (a group), 8 "Seurue raunioilla", 9 "Ryhmät yhdistyvät", 10 "Keksityn hahmon synnyinpaikka" (standalone, Haestra), 11, 12 "Teleporttaus Ton-Boriin" (new segment) and 13. Accepted together with B-16.

You will see: a blue solid line joining the places of the party's events, up to the current event, on the displayed map. The line grows as you step forward and shortens as you step back. A jump leaves a gap, a standalone event is not part of the line, and a visit to another map has its own line there.

How to check by hand (with the demo content):
1. Step through the demo events on Bay of Izar. The line follows the party from place to place.
2. The standalone event (10, the birthplace on Haestra) is not part of the line: the line goes straight from the party's last event before it, Bentara, to the one after it, the Port of Izar (11).
3. At the event with the new segment (12, the teleport to Ton-Bor) there is no line from the Port of Izar to it, and the line goes on from it to the next event (13).
4. Step to Bog End (events 6 to 8). The line there shows only the current visit, from Suonperä to the ruins. The main map keeps the whole route, and the party's visits to Suonperä and the ruins are part of it.
5. When the party has left Bog End, switch to it by hand. The visited places are there as dots and there is no line.
6. Step back. The line shortens.

Acceptance criteria:
- [x] The segments are worked out once when the app loads, and each step only clips them.
- [x] The displayed map shows the party's lines up to the current event, and nothing from later events. A history map shows all of them, and a visit map shows only the current visit.
- [x] A map may have `routes`, `"history"`, `"visit"` or `"overview"`. The build rejects another value with an error that names the file and the map, and an omitted value means history for the main map and visit for the others.
- [x] The line is solid, blue and clearly thinner than the current marker, and is drawn below the dots and the marker.
- [x] A segment of one event draws no line, a new segment leaves a gap, and the lines are the same however you arrived at an event.
- [x] After a manual map switch, the lines of that map are shown by the same rule.

Automated tests: component tests that the right number of lines is drawn for a given event; Playwright tests that step through the extended fixtures and check the line's ends against the markers at each step, the gap at a new segment, the separate line on the second map, and stepping back.

## B-18 Split-group route logic

Status: defined

Related: FR-5, FR-8.

Depends on: B-16 (the party route logic).

Scope note: this extends the route function from B-16 to named groups (a `track` that is not empty and not `none`). It was "Tracks, standalone events and new segments" in the outline, and the standalone and `newSegment` rules moved to B-16. It is accepted together with B-19. The rules below make FR-5 exact where it was not, and the product owner has approved them. They are written into `REQUIREMENTS.md` (FR-5) and `DESIGN.md`.

Rules: a group's events are joined in date order, among themselves only. The party's events in between do not end the split, so the party and the group can go on at the same time. A group's line starts at the party's last event before the group's first event, and ends at the first party event after the group's last event, which is where the group rejoins. A start or an end is drawn on a map only when that party event has a place on that map. A group with no later party event ends at its last event. Breaks, other-map visits, and `newSegment` work as for the party. A group that is split twice under the same name is one line, unless `newSegment` or another name is used for the second split.

Worked examples (P1, P2, P3 are party events, G1, G2 are events of the group `scout`, all on the main map). As in B-16, a map that an example names is the only map where the event has a place, unless the example says otherwise:
1. P1, G1, G2, P2 give the party P1-P2, and the group P1-G1-G2-P2. The group's line starts at P1 where it split and ends at P2 where it rejoined.
2. P1, G1, P2, G2, P3 give the party P1-P2-P3, and the group P1-G1-G2-P3. The party's event P2 does not interrupt the group.
3. Two groups, `scout` and `mage`, have their own lines, each with its own start and end.
4. P1, G1, G2 with no later party event give the group P1-G1-G2, which ends at G2.
5. G1 as the first event of all has no start: the group's line starts at G1.
6. P1 on the main map, G1 only on Bog End, P2 on the main map: on the main map G1 has no place, so the group has no line there. On Bog End G1 is alone, because P1 is not on Bog End.
7. P1, G1 with `newSegment`, G2, P2 give the group G1-G2-P2. There is no line from P1 into G1.
8. A standalone event between group events is ignored.
9. P1 on the main map, P2 only on Bog End, G1 on both maps, P3 on the main map: the group's start is P2, the party's last event before G1. On Bog End the line goes from P2 to G1, and on the main map it has no start, because P2 has no place there.
10. Clipping works as for the party: at G1 the group's line is P1-G1, and the end at P2 appears only when the current event is P2 or a later one.

How to check by hand: read the rules and examples and tell me if any is not how you want split groups to behave. In particular, say if the line should not start from the party's last place or end at the rejoin.

Acceptance criteria:
- [ ] The route function returns the segments of each named group per map, following the rules and examples above, together with the party's from B-16.
- [ ] Every worked example is a unit test.
- [ ] Group events never change the party's segments and the party's events never end a group's split, apart from being its start and end.
- [ ] Clipping at an event keeps the group's start, the events up to it, and the rejoin only from the rejoin event on.

Automated tests: the unit tests of the worked examples, plus tests that two groups do not affect each other, that the party's result is the same with and without groups, and that clipping is consistent at every event.

## B-19 Drawing split routes

Status: defined

Related: FR-5.

Depends on: B-18 (the split-group logic) and B-17 (drawing routes).

Scope note: the fixtures and the demo events get a group that splits, travels and rejoins (the demo already has a group on Bog End). Accepted together with B-18.

You will see: a dashed line for each group, in a colour of its own, from where it split from the party to where it rejoins, growing as you step. While the group is split, the party's solid line goes on separately. Where the group rejoins, its line meets the party's.

How to check by hand (with the demo content):
1. Step to event 7 ("Tiedustelijat raunioilla"), the first event of the group. On Bog End a dashed line appears from the party's place at event 6 to it.
2. Step on. The party's solid line and the group's dashed line are clearly different, and the group's line stops growing when the group's events end.
3. At the rejoin event the dashed line ends at the party's place and the line is complete. Step back to see it shorten.
4. Open the real events. There is no group, so only the party's line is shown.

Acceptance criteria:
- [ ] Each group is drawn with a dashed line in its own colour from a fixed palette, taken in the order the groups first appear. The party's line stays solid blue.
- [ ] The line grows with the current event, starts at the split place, and reaches the rejoin place only when the current event is the rejoin event or a later one.
- [ ] Group lines are drawn below the party line and below the dots and marker.
- [ ] On each map only the segments that have places on that map are shown, and the map's `routes` setting decides whether a group's earlier visits stay (history, overview) or only its current visit is shown (visit).
- [ ] There is no legend. (A legend could be added after the first version.)

Automated tests: component tests for the number and style of the lines; Playwright tests that step through the extended fixtures and check the group's line ends at each step against the markers, that two groups have different colours, and that stepping back shortens the line.

### Milestone 2: the routes (after B-19)

A second checkpoint for a longer manual test of how the story's movement looks, with your feedback before the journal work begins. B-17 is a smaller checkpoint on the way, for the party's line alone.

What to try: step through the demo events and the real events forwards and backwards, switch maps by hand, and in `content/events` try a few edits of your own (add a `track`, a `newSegment`, an `n/a` event) to see how a route behaves.

Feedback wanted:
- the look of the lines: colours, the thickness, solid and dashed, and the lack of arrowheads and of a legend;
- whether the way a split group starts and ends feels right, and what happens when the party continues at the same time;
- whether the routes help the story or crowd the map, especially with many events. The main map keeps the whole route, and fading or limiting the old lines is an option if it gets crowded;
- whether showing only the current visit on the fine maps feels right, and whether Haestra should keep its history.

---

# Outlined items (status: backlog)

These are outlined only. Each is refined into a defined item, with acceptance criteria, automated tests and a manual check, when its turn comes. Each will also state what you can expect to see and how to check it by hand.

## B-20 Journal content
Read journal entries (player character, NPC, item, location, note) with their fields and language rules, and validate them, including that a location entry's id exists in `locations.json`. A temporary list of entries is shown. FR-6.

## B-21 Journal button and panel
Note for the refinement: decide these before the item is defined. (1) `DESIGN.md` lists `/#/journal` as the journal index "over the current event", but an address with no event id has no current event, and since B-11 every path other than `/event/<id>` redirects to the first event (a unit test uses `/journal/nowhere` for that). Decide how the panel is held in the address, for example a `journal` query parameter on the event address (also for the index), and update the URL list in the design and that test. (2) Stepping keeps every parameter except `map` (B-12), so an open panel would stay open when the event changes. Decide whether that is wanted. The arrow-key stepping lives in the event panel and must not fire while the journal panel has focus. (3) Opening and closing the panel must add history entries, so that back and Escape return to the same event, and an unknown entry in the address is ignored (FR-6). (4) The dismissible notice for an unknown event is kept in the history state of the redirected entry (B-11), which must keep working with the panel's entries.

A button at the top right that opens a panel sliding in from the right with the journal index grouped by type. Escape and the back button close it, and the event and map stay untouched. You will see the panel open and close over the live map. FR-6.

## B-22 Journal entry view
Open an entry from the index: name, lead image, motto for player characters, and text. You will see a character page in the panel. FR-6.

## B-23 Journal links in text
`[[id]]` and `[[id|text]]` links in event and journal text that open the entry in the panel, with build errors for links to entries that do not exist. You will see names in the event text become links. FR-6.

## B-24 Events listed on entries
Each entry lists the events that link to it, a location entry lists the events held at that place, and the location in an event's details links to its entry. You will see the event lists in the panel and the location name in an event become a link. FR-6.

## B-25 Character excerpts
The paragraphs of events that link to a character appear in the character's entry under "In the campaign", with the event's title, date and a link back. FR-6.

## B-26 Journal-only passages
The `:::journal{for="..."}` block, hidden in the event and shown only in the named entries. You will see a passage that is missing from the event text but present in the character's entry. FR-6.

## B-27 Images in text
Images in event and journal text with captions, a full-size viewer, lazy loading, and build warnings for large or missing alt text. You will see pictures with captions in events and entries, and click one to open it large. FR-3, FR-4, FR-6.

## B-28 Build summary and warnings
The summary per language of missing translations, and warnings for unused images, locations and entries, and tracks that never return to the party. (The warning for an event that is `n/a` on the main map although its `showOn` location has a main position is in B-34.) You will see the warnings and the per-language summary in the terminal when you build. "Validation rules".

## B-29 Phone layout
A layout that works on a phone: the event panel, the map and a full-screen journal panel. You will see the site working in the browser's phone view and on your own phone. FR-6, "Devices".

## B-30 Accessibility
Keyboard operation of the whole interface, focus handling for the journal panel, readable contrast, and alt texts. You will see that the whole site can be used with the keyboard alone. "Non-functional requirements".

## B-31 Performance with a large campaign
A generated stress content set of 300 events, 50 locations and 30 entries, a test that stepping takes under 200 ms, and a manual load check of the deployed site. You will see the site stay responsive with a campaign of that size and the first load time on the real site. FR-2, "Performance".

## B-32 Replacing the demo content
A short guide for replacing the demo content in `content/` with the real campaign content, which is drafted in `campaign/` meanwhile (see `campaign/README.md`), and a final check of the documents against the finished system. You will see your own first real events running on the site.

---

# After the first version (not scheduled)

- A helper tool for placing locations and events on the map without measuring positions.
- Clicking a map marker to select that location's events.
- A share-link button for an event.
- Timeline filters (character, location, session).
- Styling the journal button as a book and a fantasy visual theme.
