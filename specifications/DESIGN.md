# Campaign Chronicles: Software Design Description

Status: all topics have been discussed and agreed. Requirement ids (FR-1 to FR-8) refer to `REQUIREMENTS.md`.

## Data model

- Locations: named places in a shared locations file, each with a coordinate per map. Events refer to a location by id, so many events can share a place. An event may instead use a one-off coordinate when it is not at a named place.
- Event files: one Markdown file per event. The date lives only in the file name, in the form `6050-1-037-02-ambush.md`: year, month number, day, then an order number within that day, then a free-text slug. Months are numbered 1 to 5 in the data (1 Winter, 2 Spring, 3 Summer, 4 Autumn, 5 Fall) and always shown spelled out in the UI, for example "TE 6050, 37th of Winter". The build rejects two events with the same date and order number.
- Journal links: wiki-style, `[[aldric]]` or `[[aldric|the knight]]`. The build checks that every id exists.
- Tracks: a `track` field in the event front matter. Omitted means the party, a free-text name means a split group, and `none` means a standalone event. An optional `newSegment: true` suppresses the route line into that event.
- Event fields: a required title, plus the date from the file name, the location(s), and the Markdown body. No summary, session or characters-present fields; the characters and items an event involves come from the journal links in its text.
- Images: one shared images folder, referenced with plain Markdown image syntax in the text: the alt text goes in the brackets and the optional title string is shown as a visible caption, for example `![Dusk over a wide, shallow river](images/ford.jpg "The ford at Stroane")`. The build checks that each file exists and respects the size limits.
- Journal entries: a type (player character, NPC, item, location or note), a display name, an image, and body text. For player characters and NPCs the body is the background; player characters also have a motto. The list of campaign events is generated automatically. The id is the file name. Location entries are the exception: they have no name field, because their name comes from `locations.json`.
- Location entries: `journal/<location-id>.md` of type `location`, where the file name equals the id of a location in `locations.json`. Positions stay in `locations.json`; the entry adds an image and descriptive text. Where an entry exists, the location shown in an event's details becomes a link to it, `[[location-id]]` works in text, and the entry lists the events held at that location (those whose `location` or `showOn.location` is this place, not events that merely mention it), in date order with a link to each. A location without an entry still appears on the map, and its name is simply not a link.
- Character event lists: automatic. Every paragraph of an event that contains a journal link such as `[[aldric]]` is also shown in that entry's "In the campaign" section (for player characters and NPCs), together with the event's title and date and a link back to the event. The unit is the paragraph: for a single sentence, put it in its own paragraph. Events may also carry journal-only passages, attached to a character, that appear only in that character's journal and not in the event, written with the `:::journal{for="..."}` block (see "File formats").
- NPCs have the same fields as player characters except the motto. Items and notes have a name, an image and a description. All entry types except locations get the automatic list of events that link to them; location entries list the events held at that place instead.
- Positions: every position on a map is written as `[x, y]` in percent of the image width and height, measured from the top-left corner. Percent survives resizing or re-exporting an image. The app converts it once to Leaflet's coordinates. The maps file still declares each image's pixel size so the build can check the image and Leaflet can use its aspect ratio.

## File formats (agreed examples)

Maps (`maps.json`): exactly one map has `main: true`; width and height are the image's pixel size.
```json
[
  { "id": "main",  "name": "Haestra Region", "image": "maps/haestra.jpg", "width": 1600, "height": 1100, "main": true },
  { "id": "fine",  "name": "Stroane Valley", "image": "maps/stroane.jpg", "width": 1600, "height": 1000 },
  { "id": "world", "name": "Emer",           "image": "maps/emer.jpg",    "width": 1600, "height": 1200 }
]
```

Locations (`locations.json`): a position is `[x, y]` in percent of the map image, from the top-left. A location appears only on maps it has a position for.
```json
[
  { "id": "haestra-keep", "name": "Haestra Keep",
    "positions": { "main": [50.8, 41.4], "fine": [75.3, 69.0] } },
  { "id": "ford-crossing", "name": "The Ford", "positions": { "fine": [40.0, 31.0] } }
]
```

Event (`events/6050-1-037-02-ambush.md`):
```markdown
---
title: Ambush at the Ford
location: haestra-keep          # main-map location, "n/a" for none, or position: [50.8, 41.4]
showOn:                         # optional: show this event on another map instead of the main one
  map: fine
  location: ford-crossing       # or position: [x, y]
track: aldric                   # omit for the party, "none" for standalone
newSegment: true                # optional
---
The party reached the river at dusk. [[aldric]] went ahead alone.

![Dusk over a wide, shallow river](images/ford.jpg "The ford at Stroane")

[[mira|The scout]] spotted riders on the far bank.

:::journal{for="aldric"}
Aldric first doubted the order here, though he told no one.
:::
```
- A `:::journal{for="..."}` block is hidden in the event and shown only in the named character's entry (`for="aldric,mira"` for several).
- Rules checked by the build: `location` exists and has a position on the main map unless it is `n/a`; `showOn.location` has a position on `showOn.map`; `n/a` requires `showOn`; every `for` and `[[...]]` id exists; the file name's date and order number are valid and unique.

Folder layout:
```
content/
  campaign.json
  maps.json
  locations.json
  maps/            haestra.jpg, stroane.jpg, emer.jpg
  images/          ford.jpg, aldric.jpg, ...
  events/          6050-1-037-02-ambush.md, ...
  journal/         aldric.md, mira.md, ring-of-stroane.md, stroane-war.md, ...
```

Campaign settings (`campaign.json`): the calendar and site text live here, so nothing about the calendar is hard-coded.
```json
{
  "title": "Chronicles of Haestra",
  "era": { "name": "Third Era", "abbreviation": "TE" },
  "months": ["Winter", "Spring", "Summer", "Autumn", "Fall"],
  "daysPerMonth": 70
}
```

Journal entries (`journal/<id>.md`): the id is the file name, and every entry type uses `image` for its picture. For player characters and NPCs the body text is the background, with no separate description field. The campaign events list is generated automatically (see "Character event lists").

Player character (`journal/aldric.md`):
```markdown
---
type: pc
name: Aldric of Stroane
image: images/aldric.jpg
motto: "The river remembers."
---
Born in a river village in the Stroane valley, Aldric served the [[order-of-the-ford]] until the end of the war...
```

NPC (`journal/mira.md`): as a player character, without the motto.
```markdown
---
type: npc
name: Mira the Scout
image: images/mira.jpg
---
A scout of the northern border, known for ...
```

Item (`journal/ring-of-stroane.md`):
```markdown
---
type: item
name: Ring of Stroane
image: images/ring.jpg
---
A plain iron ring said to ...
```

Location (`journal/ford-crossing.md`): the file name is the id of a location in `locations.json`, which supplies the name. The entry lists the events held there automatically.
```markdown
---
type: location
image: images/ford.jpg
---
A wide, shallow crossing on the Stroane river, used by smugglers and ...
```

Note (`journal/stroane-war.md`): free text, with an optional image.
```markdown
---
type: note
name: The Stroane War
---
Free-form lore, a faction summary, a session recap, ...
```

## Build and validation

- Processing happens at build time in a Vite plugin. It parses and validates all content files, renders Markdown to HTML, resolves `[[links]]`, builds the journal excerpts, and outputs one compact data bundle. The browser does no parsing. In the dev server the plugin re-runs when a content file is saved, so edits and errors show up immediately.
- Errors stop the build: broken links, invalid dates or ids, impossible locations, missing files. Warnings do not: images over the size limit, unused images or locations.
- Content is Markdown only: raw HTML is not allowed, so content cannot break the page layout or inject scripts.
- The output is one data bundle loaded at start, which keeps stepping and opening the journal instant. Images load lazily.
- Validation runs in the dev server while editing and in the GitHub publishing workflow before deployment, so a broken commit never replaces the live site. There is no separate standalone validate command.

### Validation rules

Errors (stop the build):
- Files and dates: an event file name doesn't match `year-month-day-order-slug.md`, or the month is outside 1 to 5 or the day outside 1 to 70; two events share the same year, month, day and order number; a required field is missing (an event title, or a journal entry's type or, except for locations, its name); a `location` journal entry's id doesn't match any location in `locations.json`; a location entry has a `name` field.
- Maps and locations: `maps.json` doesn't have exactly one `main` map, or a map's declared size doesn't match its image; a `location` or `showOn.location` id doesn't exist; a location has no position on the map it is used for, or a position is outside 0 to 100 percent; an event has `n/a` on the main map and no `showOn`.
- Links and references: a `[[id]]` link or a `:::journal{for="..."}` id doesn't match any journal entry; an image or map file doesn't exist; raw HTML appears in the text.

Warnings (the build continues):
- An image is over about 1 MB or 1600 px wide, or isn't JPEG, PNG or WebP.
- An image, location or journal entry is never used.
- An image has empty alt text.
- A split `track` has no later event returning to the party.

A `track` value is free text and is not checked against the journal, so a mistyped name creates a new track. The "never returns to the party" warning is the only safeguard.

## Application architecture

- State: the URL is the single source of truth for the current event, the active map and the open journal entry, read through React Router's hash router. The back button, a reload and later shareable links work without a second copy of the state. Map pan and zoom stay as local component state.
- Layout on desktop: the map fills the upper area, with the stepper and the event details (title, date, text, images and previous/next controls) in a lower panel, like Wheel of Timelines. The journal panel slides in from the right over the main view. On a phone the journal panel covers the screen.
- Styling: plain CSS with CSS Modules, so styles are scoped per component and a custom fantasy look is easy to build.
- Map switching: a manual map switch lasts only until the next step. Stepping always shows the new event on its own map.

URLs (hash router):
- `/#/event/<event-id>`: the main view at that event; the id is the file name without `.md`.
- `/#/event/<event-id>?map=world`: the same, with a manual map switch applied.
- `/#/event/<event-id>?journal=aldric`: the journal panel open over that event.
- `/#/journal`: the journal index open, over the current event.
- `/#/` redirects to the first event.

Components:
- App and router: reads the URL and provides the content bundle to everything below.
- MainView: the map area plus the lower panel.
  - MapView: the Leaflet map for the active map, with a MapSwitcher, location markers, route lines and the current event's marker.
  - StepperPanel: previous/next controls, plus EventDetails (title, date, the location as a link when it has a journal entry, rendered text, images).
- JournalButton: top right of the main view, opening the journal index from the same side the panel slides in from. It may later be styled as a book.
- JournalPanel: the sliding panel, showing either the JournalIndex (grouped by type) or a JournalEntry (image, text, "In the campaign" excerpts, linked events).
- ImageViewer: full-size view when an image is clicked.
- Shared logic without UI: a route builder (the per-map, per-track route rules), a date formatter and a coordinate converter (percent to Leaflet).

Map markers: the map shows the current event's marker prominently, plus small dots for the places visited so far on that map. Places the story hasn't reached yet are not shown. Clicking a marker to select its events is a future improvement, not part of the first version.

## Data flow

At build time the Vite plugin turns the content files into one bundle containing:
- the campaign settings, the maps and the locations;
- all events in date order, each with its date, title, rendered HTML text, image references, and resolved main-map position and optional `showOn` position;
- all journal entries, each with its rendered text, its image, its "In the campaign" excerpts (the paragraphs and journal-only passages from events) and the ids of the events that link to it (for location entries, the events held at that location).

At runtime:
1. The app loads the bundle once at start.
2. The router reads the URL: an event id, an optional `map` and an optional `journal`.
3. The event id gives the current event's position in the ordered list. Previous and next move that position and update the URL.
4. From the current event the app derives what is shown. The displayed map is the URL's `map` override if present, otherwise the event's `showOn` map, otherwise the main map. The markers and route lines for that map run up to and including the current event. The journal panel shows the entry or index named in the URL.

Routes are worked out at runtime, once when the app loads. A plain function builds all segments per map and track from the ordered events, and stepping shows the segments up to the current event. This is cheap for about 300 events, easy to unit-test, and keeps the route rules in the app code rather than the build plugin.

Bad links: if the URL names an event that doesn't exist, the app shows the first event with a dismissible notice. If it names a journal entry that doesn't exist, the entry is ignored and the event is shown. The app never shows a blank screen.

## Deployment

- Publishing: a GitHub Actions workflow runs on every push to the `master` branch. It installs dependencies, runs the tests and the content validation, builds the site and deploys it with GitHub's official Pages action. Nothing built is committed to the repository, and a failed validation never replaces the live site.
- The site uses an existing public repository, `https://github.com/tmikonen/kulthea`, separate from the Jekyll blog. Its default branch is `master` and it already holds the three map images. GitHub Pages is not yet enabled; it must be switched on in the repository settings with the source set to "GitHub Actions".
- The `specifications` folder stays in the repository.
- The existing map images exceed the image limits (about 1 MB, 1600 px wide). That is accepted for now: the build reports them as warnings and continues. Their real sizes are unknown, so the 3 s load target may be at risk, and a higher limit for maps or a resize may be needed later.
- Address: the project site `https://tmikonen.github.io/kulthea/`, which leaves the Jekyll blog untouched. The app is built with `/kulthea/` as its base path. A custom domain is not planned.

## Testing approach

- Logic and components: Vitest and React Testing Library. Vitest covers the pure logic (route rules, date handling, coordinate conversion, the content parser and validator, journal excerpts). React Testing Library covers component behaviour such as the stepper and the journal panel.
- Browser tests: Playwright against the built site, for the key flows, because Leaflet and layout do not work properly in a simulated environment. These check the main acceptance criteria: stepping updates the map, the journal panel keeps the event and map position, the back button and Escape close the panel, and a phone-sized screen works.
- Fixtures: a small handcrafted miniature campaign (a few events, two maps, a split track, a journal-only passage, an `n/a` event) is used by the tests instead of the real content. Test names include requirement ids such as FR-5, so it is visible which acceptance criteria are covered.
- Performance: the 200 ms stepping target is measured in Playwright. The 3 s first-load target depends on the real maps, so it is checked by hand against the deployed site.
- The validator is tested too, with cases for each error and warning in the validation rules.
- The tests run in the publishing workflow before the build is deployed.

## Decision record

### DD-1 Application framework: React + Vite + TypeScript

Decision: a single-page application built with React, Vite and TypeScript.

Context: the central experience is one screen in which the map, the event stepper and the route lines share state (the current event). Journal entries open as a panel sliding in over that screen, from a link in an event or from a journal index, and closing the panel must return to the same event and map position without any reload (see FR-6).

Reasons:
- One running app keeps the current event and map position alive while the journal panel opens and closes. Opening an entry is a single state change.
- Astro was the main alternative. Its strength is a static page per content item, with Markdown validation built in. That strength does not help here: a page per journal entry would reload the page and discard the live map, and putting the whole app in one Astro island would remove its advantage while adding a second concept to learn.
- Vite replaces Create React App, which is deprecated.
- TypeScript catches data-shape mistakes early, which matters because the content is hand-written.

Consequences:
- Journal entries are not separate pages, so search engines will not index them individually. Accepted: the audience is mainly the DM and the players.
- Markdown parsing, front-matter reading and content validation are not built in, so a small custom build step is required (see "Build and validation").

### DD-2 Map technology: Leaflet with flat images

Decision: Leaflet, using plain images as maps (its simple coordinate system), through the react-leaflet wrapper.

Reasons: pan, zoom, touch support, markers and polylines are built in, the library is small and proven, and it handles several independent image maps by swapping the image layer. A custom SVG overlay would give more control over appearance, but marker, route and zoom-scaling logic would have to be written and maintained.

Consequences: Leaflet's image coordinate system measures y upward from the bottom, which must be handled once in a single conversion function. Independent maps (no alignment between scales) keep the model simple.

### DD-3 Multiple maps and routes

Decision: maps are independent images with their own coordinates. Each event has a main-map location (or N/A) and an optional `showOn` entry naming one other map and a location on it; when present, that map is the one displayed. Routes are derived from event order, per map and per track, with an optional "new segment" flag per event. Standalone events belong to no track.

Reasons: it keeps authoring to locations and dates and avoids hand-written route data. Breaks happen where the data already says so (N/A), and the flag covers the one case the data cannot show (a jump).

### DD-4 URL routing: hash URLs

Decision: hash-based URLs such as `/#/event/6050-1-037-02-ambush?journal=aldric`.

Reasons: GitHub Pages has no server-side rewrites, so path URLs would need a 404.html workaround. Hash URLs work without any, and the URL can carry the current event, the active map and the open journal entry, which makes the back button close the journal panel (FR-6) and leaves room for shareable event links later.

Consequences: addresses are less tidy than path URLs.

### DD-5 Content layout: hybrid JSON and Markdown

Decision: short structured data (the campaign settings, maps and locations) is stored as JSON. Each event and each journal entry is its own Markdown file with front matter (for events: title, locations, track; the date comes from the file name) followed by the prose.

Reasons: long descriptions are pleasant to write and review in Markdown files, one file per item keeps Git diffs small, and compact tabular data is clearer in JSON than in front matter.

Consequences: a build step reads both formats, validates them against the "Validation rules" (dates, N/A rules, broken links, image limits), and fails with a clear message.
