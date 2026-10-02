# Campaign Chronicles: Requirements

## 1. Purpose and scope

A static website that presents a chronicle of past sessions of a Shadow World campaign (Haestra, NW Emer, after the death of Katra of Stroane and the end of the Stroane war) as events on a map, browsed in time order.

- Users: the DM (sole editor), the players, and the public.
- Content: events from past sessions, plus character background events such as birthplaces (see FR-8). No planned or future events.
- Everything is visible. There is no spoiler control.
- Authoring: the DM, mostly by hand-editing data files.

## 2. Functional requirements (MVP)

### FR-1 Map
Several independent map images of different scales (a main campaign map, a fine-scale regional map, and a largest-scale map for character backgrounds). Each is screen-sized with simple pan and zoom. Maps are unrelated images: each has its own coordinates and they need not align.
- AC: the active map loads and zooms on desktop and on a phone.
- AC: 50 markers stay responsive.
- AC: the map shows the current event's marker prominently, small dots for the locations of earlier events on that map (standalone events included), and nothing for places the story has not reached.
- AC: the user can switch maps manually from a map switcher.
- AC: stepping to an event whose displayed map differs from the current one switches maps automatically.
- AC: switching maps does not change the current event.
- AC: stepping to another event always shows that event on its own map, even after a manual map switch.

### FR-2 Timeline
Events are shown in chronological order and stepped with previous/next controls. The current event is highlighted on the map. There are no filters in the MVP.
- AC: stepping updates the map and the details in under 200 ms.
- AC: 300 events work without degradation.
- AC: opening a link to an event that does not exist shows the first event with a dismissible notice, never a blank screen.

### FR-3 Event
An event is a scene or moment at one location on one date, with a Markdown description and images. Several consecutive events may share a location. Order within a day follows an order number in the event's file name.
- AC: details show the date as "TE 6050, 37th of Winter", the location, the text and the images.
- AC: clicking an image opens it at full size in a viewer that can be closed.

Every event defines a location on the main map, which may be "N/A". An event may also define a location on at most one other map. If it does, that other map is the one displayed for the event, and otherwise the main map is displayed. An event with "N/A" on the main map must define a location on another map.
- AC: an event with a location on another map is displayed on that map.
- AC: the build rejects an event that has "N/A" on the main map and no location on another map.

### FR-4 Floorplans and sub-maps
Floorplans, sub-maps and other pictures are ordinary images, shown with the event description or in the journal. Markers appear only on the main map and on the other maps an event is placed on, never on these images.
- AC: images placed in an event or a journal entry display at a size that fits the panel without horizontal scrolling.

### FR-5 Party routes
The party is one group by default. A character or sub-group gets its own route only while split from the party. Routes are drawn as lines between the locations of consecutive events.

Routes are derived from event order, so the DM writes no route data. A route is drawn per map, and connects consecutive events of the same track that both have a location on that map. An event without a location on the map ("N/A") breaks the route on that map. Events that took place on another map still have main-map locations, so they stay part of the main route when the user returns to the main map. Each separate visit to another map is its own route segment.

Tracks: the party is one track by default. A character or sub-group gets its own track only while split from the party, and its route ends at the event where the group rejoins and merges back into the main route. Standalone events (see FR-8) belong to no track and are ignored by every route.

An event may carry an optional "new segment" flag. It means no line is drawn from the previous event of its track to this one, for jumps such as teleporting.
- AC: routes up to the current event are drawn.
- AC: split tracks are visually distinct from the main route.
- AC: a split route stops at the rejoin event.
- AC: the main route connects party events on either side of a standalone event as if it were absent.
- AC: an event placed only on another map (main location N/A) adds no line to the main map, and the main route breaks there.
- AC: a "new segment" flag suppresses the line into that event on every map.

### FR-6 Journal
Journal entries (player characters, major NPCs, items, locations and free-form notes) are mostly images plus text, written in Markdown. They open in a panel that slides in over the main view from the side, so the map and the current event stay in place underneath. The journal is visually distinct from the main view.
- AC: an entry opens from a link in event text or from a journal index, opened with a button at the top right of the main view.
- AC: the journal index groups entries by type (player characters, NPCs, items, locations, notes).
- AC: a location entry shows the location's name, an image, descriptive text and the list of events held at that location, in date order, each linking to its event.
- AC: where a location has a journal entry, the location shown in an event's details links to that entry.
- AC: a web address that names a journal entry that does not exist is ignored and the event is shown.
- AC: the build rejects event or journal text that links to a journal entry that does not exist.
- AC: opening or closing the panel never changes the current event, the map position or the zoom level, and does not reload the page.
- AC: following a link from one journal entry to another replaces the panel content without closing it.
- AC: the browser back button and the Escape key close the panel and return to the same event.
- AC: event text can link to a journal entry with a simple syntax, and events are expected to contain many such links.
- AC: each entry other than a location lists the events that link to it, and selecting one of them goes to that event.
- AC: for player characters and NPCs, every paragraph of an event that links to the character is also shown in the character's journal entry, with the event's title and date and a link back to the event.
- AC: an event can carry a passage that is attached to a character and shown only in that character's journal, not in the event.
- AC: a player character entry shows a name, picture, background and motto; an NPC entry shows the same except the motto.
- AC: each entry shows its images and text without horizontal scrolling on a phone.

### FR-7 Calendar
Third Era, five months of 70 days each, in the order Winter, Spring, Summer, Autumn, Fall.
- AC: days 1 to 70 validate and anything else is rejected.
- AC: events sort by year, month, day, then the order number in the file name.
- AC: two events with the same date and order number are rejected.

### FR-8 Standalone events
Events that are not part of any route, such as a player character's birthplace or background, are ordinary events in the same timeline. They are stepped in date order with everything else, show a single marker on their map, and have no route line.
- AC: a standalone event appears in the stepper in date order and displays its map and marker.
- AC: it adds no route line and does not interrupt the party's route.

## 3. Post-MVP

- A helper tool for placing locations and events on the map without measuring pixel coordinates.
- Clicking a map marker to select that location's events.
- Shareable links to a single event.
- Timeline filters (character, location, session).

## 4. Non-functional requirements

- Performance: map and first event visible within 3 s on broadband; images lazy-load. Scale target is about 300 events, 50 locations and 30 journal entries.
- Devices: desktop first, usable on mobile. Current Chrome, Firefox, Safari and Edge.
- Hosting: GitHub Pages from its own repository (`tmikonen/kulthea`), published by a GitHub Actions workflow, static files only, no backend.
- Authoring: data in JSON and Markdown files, with a build-time check that catches broken references and invalid dates.
- Single application: map, stepper and journal run in one page without full page loads. Journal entries are not separate pages, so search engines will not index them individually. This is accepted because the main audience is the DM and the players.
- Back button: browser history reflects the open journal entry and the current event, so back and forward behave as expected.
- Accessibility (practical basics, no formal WCAG claim): keyboard-operable stepping, alt text on images, readable contrast and text size, semantic page structure.
- Images: JPEG, PNG or WebP, at most about 1 MB each and 1600 px wide. The build warns about files over the limit but does not fail. The existing map images exceed the limit and are accepted for now, so the 3 s load target may need a higher limit for maps or a resize.

## 5. Open items

None.

Future ideas such as route waypoints along roads are not in scope.
