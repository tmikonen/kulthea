# Kulthea Campaign Chronicles: Backlog

The work is split into small increments, in implementation order. The ids are stable labels, not positions: the order of the sections below is the implementation order, and it can differ from the order of the ids (B-11 and B-12 come before B-9 and B-10). Each increment adds one testable piece of functionality. Some code will be revisited when a later item extends it, and that is accepted. Requirement ids (FR-n) refer to `REQUIREMENTS.md`, and section names refer to `DESIGN.md`.

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

Status: done

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

Status: done

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

Status: done

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

Status: backlog

Not yet defined: outlined only, to be refined with the product owner before it starts. It now comes before B-9 and B-10, so B-9 and B-10 add the date and the text to the event panel that this item creates.

Hash route for an event (`/#/event/<id>`), redirect from `/#/` to the first event, a fallback with a dismissible notice for an unknown id, and the main layout with the map above and an event panel below replacing the temporary event list from B-8. You will see the first event's title and its location under the map. FR-2, FR-3, DD-4.

## B-12 Stepping through events

Status: backlog

Not yet defined: outlined only, to be refined with the product owner before it starts.

Previous and next controls, a URL that follows the current event, controls disabled at the ends, keyboard operation. You will see the event change as you click and the address change with it. FR-2.

## B-9 Calendar and dates

Status: defined

Related: FR-7, "File formats" (`campaign.json` dates), "Languages".

Depends on: B-11 and B-12 (the event panel and stepping). Do not start before they are done.

You will see: the current event's date in the event panel, written in full in the chosen language: "K.A. 6050, Talven 37. päivä" in Finnish and "TE 6050, 37th of Winter" in English.

How to check by hand:
1. Open the page and look at the date in the event panel.
2. Switch between FI and EN. The date changes format and month form.
3. Step to events on the 1st, 2nd, 3rd, 11th, 12th, 13th, 21st and 70th day. The English endings are 1st, 2nd, 3rd, 11th, 12th, 13th, 21st and 70th.

Acceptance criteria:
- [ ] A date formatter builds a date from the campaign settings: `{era}`, `{year}`, `{month}` (the in-date form), `{day}` and the English `{ordinal}`, which is empty in Finnish.
- [ ] The Finnish month forms are Talven, Kevään, Kesän, Ruskan and Martaan, and the English ones are Winter, Spring, Summer, Autumn and Fall.
- [ ] The date in the event panel uses the formatter and follows the chosen language.
- [ ] The demo events include dates on days 1, 2, 3, 11, 12, 13, 21 and 70, so the English endings can be checked by hand (the B-8 demo events already have them, so only adjust if needed).

Automated tests: unit tests for the formatter in both languages for all five months, days 1 to 70 and the ordinal edge cases; a Playwright test for the two formats.

## B-10 Event text and language sections

Status: defined

Related: FR-3, FR-9, DD-5, "Languages", "Validation rules" (languages, raw HTML).

Depends on: B-11 and B-12 (the event panel and stepping). Do not start before they are done.

You will see: the event panel shows the text of the current event, in the chosen language. An event with no English text shows the Finnish text with a small note when English is chosen.

How to check by hand:
1. Step to an event that has both languages. Switch language. The text changes.
2. Step to an event that is only in Finnish and choose English. The Finnish text is shown with the note "Not available in this language".
3. Add raw HTML (for example `<b>`) to an event file. An error is shown.
4. Add an `@de` section. An error is shown for an unconfigured language.

Acceptance criteria:
- [ ] The event body is split into language sections by marker lines (`@fi`, `@en`); text with no marker is the default language.
- [ ] The Markdown is rendered to HTML at build time, and raw HTML is not allowed.
- [ ] The text is taken in the chosen language, falling back to the default language together with the "not available in this language" note (from `ui.json`).
- [ ] Links (`[[...]]`), images and `:::journal` blocks are not interpreted yet: they are added in B-23, B-27 and B-26, so the demo event texts contain none of them until then.
- [ ] Errors: an unconfigured language, a repeated section for the same language, no default-language text, unmarked text together with an explicit default-language section, raw HTML.

Automated tests: unit tests for the section splitter, the language rules and the HTML check; component tests for the fallback note; a Playwright test for the language switch on event text.

---

# Outlined items (status: backlog)

These are outlined only. Each is refined into a defined item, with acceptance criteria, automated tests and a manual check, when its turn comes. Each will also state what you can expect to see and how to check it by hand.

## B-13 Current event marker
The current event's marker on its map, using the main location, a one-off position, or none for `n/a`. The map view moves to show the marker. You will see the marker follow the stepping. FR-1, FR-3.

## B-14 Places visited so far
Replace the show-everything markers of B-7 with the current marker plus small dots for the locations of earlier events on that map. You will see the dots accumulate as you step forward and disappear as you step back. FR-1.

## B-15 Events on another map
An event with `showOn` is shown on that map automatically, a manual switch lasts only until the next step, and `map` in the URL is respected. You will see the map change when stepping to such an event. FR-1, FR-3.

## B-16 Party route logic
A pure route builder for the party track on each map, with breaks at `n/a` and separate segments per visit to another map. Verified only by unit tests and a debug view.

## B-17 Drawing the party route
Route lines up to the current event on the displayed map. You will see the line grow as you step forward. FR-5.

## B-18 Tracks, standalone events and new segments
Route logic for split groups that rejoin, standalone events that are ignored by routes, and the `newSegment` flag. Verified by unit tests and by extending the debug view of B-16, which lists the route segments per map and track. FR-5, FR-8.

## B-19 Drawing split routes
Split-group routes drawn in a clearly different style from the party route. You will see a second line appear while the group is split and stop where it rejoins. FR-5.

## B-20 Journal content
Read journal entries (player character, NPC, item, location, note) with their fields and language rules, and validate them, including that a location entry's id exists in `locations.json`. A temporary list of entries is shown. FR-6.

## B-21 Journal button and panel
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
The summary per language of missing translations, and warnings for unused images, locations and entries, and tracks that never return to the party. You will see the warnings and the per-language summary in the terminal when you build. "Validation rules".

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
