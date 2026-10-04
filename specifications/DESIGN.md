# Kulthea Campaign Chronicles: Software Design Description

Status: all topics have been discussed and agreed. Requirement ids (FR-1 to FR-9) refer to `REQUIREMENTS.md`.

## Data model

- Locations: named places in a shared locations file, each with a coordinate per map. Events refer to a location by id, so many events can share a place. An event may instead use a one-off coordinate when it is not at a named place.
- Event files: one Markdown file per event. The date lives only in the file name, in the form `6050-1-037-02-ambush.md`: year, month number, day, then an order number within that day, then a free-text slug. Months are numbered 1 to 5 in the data (1 Winter, 2 Spring, 3 Summer, 4 Autumn, 5 Fall) and always shown spelled out in the UI in the chosen language, for example "TE 6050, 37th of Winter" (see the calendar settings in "File formats"). The build rejects two events with the same date and order number.
- Journal links: wiki-style, `[[aldric]]` or `[[aldric|the knight]]`. The build checks that every id exists.
- Tracks: a `track` field in the event front matter. Omitted means the party, a free-text name means a split group, and `none` means a standalone event. An optional `newSegment: true` suppresses the route line into that event.
- Event fields: a required title, plus the date from the file name, the location(s), and the Markdown body. No summary, session or characters-present fields; the characters and items an event involves come from the journal links in its text.
- Images: one shared images folder, referenced with plain Markdown image syntax in the text: the alt text goes in the brackets and the optional title string is shown as a visible caption, for example `![Dusk over a wide, shallow river](images/ford.jpg "The ford at Stroane")`. The build checks that each file exists and respects the size limits.
- Journal entries: a type (player character, NPC, item, location or note), a display name, an image, and body text. For player characters and NPCs the body is the background; player characters also have a motto. The list of campaign events is generated automatically. The id is the file name. Location entries are the exception: they have no name field, because their name comes from `locations.json`.
- Location entries: `journal/<location-id>.md` of type `location`, where the file name equals the id of a location in `locations.json`. Positions stay in `locations.json`; the entry adds an image and descriptive text. Where an entry exists, the location shown in an event's details becomes a link to it, `[[location-id]]` works in text, and the entry lists the events held at that location (those whose `location` or `showOn.location` is this place, not events that merely mention it), in date order with a link to each. A location without an entry still appears on the map, and its name is simply not a link.
- Character event lists: automatic. Every paragraph of an event that contains a journal link such as `[[aldric]]` is also shown in that entry's "In the campaign" section (for player characters and NPCs), together with the event's title and date and a link back to the event. The unit is the paragraph: for a single sentence, put it in its own paragraph. Events may also carry journal-only passages, attached to a character, that appear only in that character's journal and not in the event, written with the `:::journal{for="..."}` block (see "File formats").
- NPCs have the same fields as player characters except the motto. Items and notes have a name, an image and a description. All entry types except locations get the automatic list of events that link to them; location entries list the events held at that place instead.
- Positions: every position on a map is written as `[x, y]` in percent of the image width and height, measured from the top-left corner. Percent survives resizing or re-exporting an image. The app converts it once to Leaflet's coordinates. The maps file still declares each image's pixel size so the build can check the image and Leaflet can use its aspect ratio.

## Languages

Finnish and English are supported, with Finnish as the default (see FR-9). The rule is one file per item, with all languages inside that file.

- Configuration: `campaign.json` lists the languages (`fi`, `en`) and the default language (`fi`). The default language must always be complete, and other languages are optional.
- Short text fields (an event's `title`, a journal entry's `name` and `motto`, the names of locations and maps, the campaign title) are written as a language map, for example `title: { fi: ..., en: ... }`. A plain value means the default language only.
- Long text (the Markdown body of an event or journal entry) is split into language sections by marker lines such as `@fi` and `@en`. A marker is a line that holds only `@` and a language code of two or three lowercase letters, so a line such as `@mira` is ordinary text. Everything up to the next marker belongs to that language. Text with no marker is the default language. Each section is complete in itself: it holds its own images (with alt text and captions), `[[links]]` and `:::journal` blocks.
- Interface texts live in one `ui.json`, with each text given in both languages, for example `"next": { "fi": "Seuraava", "en": "Next" }`. It is read by a small piece of our own code, with no translation library.
- Language in the URL: a `lang` query parameter, for example `/#/event/<event-id>?lang=en`, like `map` and `journal`. A missing or unknown value means the default language. A language switch (FI | EN) changes only this parameter, so the current event, map and open journal entry are kept. The choice is not remembered in the browser.
- Fallback: each field falls back to the default language when it has no text in the chosen language. When an item's body falls back, a small "not available in this language" note is shown; short fields fall back silently.
- Journal excerpts, link texts and the date display follow the chosen language. A `[[aldric]]` link without custom text shows the entry's name in the chosen language, and the "In the campaign" excerpts are built from the matching language section of each event, falling back to the default language together with the note.
- Ids, file names, folder names, field names and all documents stay in English, whatever the language of the content.
- The page's `lang` attribute follows the chosen language.

## File formats (agreed examples)

Maps (`maps.json`): exactly one map has `main: true`; width and height are the image's pixel size. `bay-of-izar` is the main campaign map, `bog-end` is the finer-scale map and `haestra` is the largest-scale map, used for character backgrounds. Ids are the file names, and names are the title-cased display names.
```json
[
  { "id": "bay-of-izar", "name": "Bay of Izar", "image": "maps/bay-of-izar.jpg", "width": 2930, "height": 1858, "main": true, "focusZoom": 2 },
  { "id": "bog-end",     "name": "Bog End",     "image": "maps/bog-end.jpg",     "width": 4042, "height": 2611 },
  { "id": "haestra",     "name": "Haestra",     "image": "maps/haestra.jpg",     "width": 4503, "height": 3147 }
]
```
`routes` is optional, `"history"` or `"visit"`: whether the map keeps the whole route or only the current visit of each track (see "Route rules"). It is `history` for the main map and `visit` for the others when omitted. `focusZoom` is optional: the number of zoom-in steps (like pressing the + button) from the whole map at which an event is shown on that map, centred on its marker. Omitted or 0 means the whole map is shown. Names are short text fields (see "Languages"): a plain value is the default language, which other languages fall back to, and `"name": { "fi": "Izarinlahti", "en": "Bay of Izar" }` gives each language its own. The same applies to the names in `locations.json`.

Locations (`locations.json`): a position is `[x, y]` in percent of the map image, from the top-left. A location appears only on maps it has a position for.
```json
[
  { "id": "haestra-keep", "name": "Haestra Keep",
    "positions": { "bay-of-izar": [50.8, 41.4], "bog-end": [75.3, 69.0] } },
  { "id": "ford-crossing", "name": "The Ford", "positions": { "bog-end": [40.0, 31.0] } }
]
```

Event (`events/6050-1-037-02-ambush.md`), here with both languages (a Finnish-only event simply has a plain `title` and an unmarked body):
```markdown
---
title:
  fi: Väijytys kahlaamolla
  en: Ambush at the Ford
location: haestra-keep          # main-map location, "n/a" for none, or position: [50.8, 41.4]
showOn:                         # optional: show this event on another map instead of the main one
  map: bog-end
  location: ford-crossing       # or position: [x, y]
track: aldric                   # omit for the party, "none" for standalone
newSegment: true                # optional
---
@fi
Seurue saapui joelle hämärissä. [[aldric]] meni edeltä yksin.

![Hämärä leveän, matalan joen yllä](images/ford.jpg "Stroanen kahlaamo")

[[mira|Tiedustelija]] huomasi ratsastajia vastarannalla.

:::journal{for="aldric"}
Aldric alkoi epäillä käskyä jo tässä, vaikka ei kertonut kenellekään.
:::

@en
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
  ui.json
  maps.json
  locations.json
  maps/            bay-of-izar.jpg, bog-end.jpg, haestra.jpg
  images/          ford.jpg, aldric.jpg, ...
  events/          6050-1-037-02-ambush.md, ...
  journal/         aldric.md, mira.md, ring-of-stroane.md, stroane-war.md, ...
```

Campaign settings (`campaign.json`): the calendar and site text live here, so nothing about the calendar is hard-coded.
```json
{
  "title": "Kulthea Campaign Chronicles",
  "languages": ["fi", "en"],
  "defaultLanguage": "fi",
  "era": {
    "name": { "fi": "Kolmas Aika", "en": "Third Era" },
    "abbreviation": { "fi": "K.A.", "en": "TE" }
  },
  "months": [
    { "name": { "fi": "Talvi",  "en": "Winter" }, "inDate": { "fi": "Talven",  "en": "Winter" } },
    { "name": { "fi": "Kevät",  "en": "Spring" }, "inDate": { "fi": "Kevään",  "en": "Spring" } },
    { "name": { "fi": "Kesä",   "en": "Summer" }, "inDate": { "fi": "Kesän",   "en": "Summer" } },
    { "name": { "fi": "Ruska",  "en": "Autumn" }, "inDate": { "fi": "Ruskan",  "en": "Autumn" } },
    { "name": { "fi": "Marras", "en": "Fall" },   "inDate": { "fi": "Martaan", "en": "Fall" } }
  ],
  "daysPerMonth": 70,
  "dateFormat": {
    "fi": "{era} {year}, {month} {day}. päivä",
    "en": "{era} {year}, {day}{ordinal} of {month}"
  }
}
```
Dates: month number 1 to 5 in a file name selects the month in this list. In a date, `{era}` is the era abbreviation, `{month}` is the month's `inDate` form (Finnish inflects the name, so "Talven 37. päivä", while English keeps "Winter"), and `{ordinal}` is the English ordinal suffix ("st", "nd", "rd", "th"; 11, 12 and 13 take "th") and empty in Finnish and in any other language, because the suffix rule is English grammar and lives in the date formatter. The `name` form is used where a month is mentioned on its own. The result is "K.A. 6050, Talven 37. päivä" in Finnish and "TE 6050, 37th of Winter" in English. Every configured language must supply the era, the five months and a date format, because a date cannot fall back to another language without mixing them.

Interface texts (`ui.json`): each text has a key and a value per language. The default language must have every text, and a missing text in another language falls back to the default language.
```json
{
  "previous": { "fi": "Edellinen", "en": "Previous" },
  "next": { "fi": "Seuraava", "en": "Next" },
  "journal": { "fi": "Päiväkirja", "en": "Journal" },
  "notTranslated": { "fi": "Ei saatavilla tällä kielellä", "en": "Not available in this language" }
}
```

Journal entries (`journal/<id>.md`): the id is the file name, and every entry type uses `image` for its lead picture (the portrait for a character). An entry can have any number of further images, placed in the text with ordinary Markdown image syntax, exactly as in events; their alt text and captions are written in each language section, and the build checks them like any other image. For player characters and NPCs the body text is the background, with no separate description field. The campaign events list is generated automatically (see "Character event lists"). The `name` and `motto` fields and the body follow the rules in "Languages": the examples below use a single language (written in English for readability), so their texts are plain values and unmarked bodies, and a translated entry would write `name: { fi: ..., en: ... }` and add an `@en` section.

Player character (`journal/aldric.md`):
```markdown
---
type: pc
name: Aldric of Stroane
image: images/aldric.jpg
motto: "The river remembers."
---
Born in a river village in the Stroane valley, Aldric served the [[order-of-the-ford]] until the end of the war...

![Aldric at the ford, sketched in charcoal](images/aldric-sketch.jpg "A sketch by the party's scribe")
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
- Map images are imported by the plugin's generated module, so Vite serves them in the dev server and emits them with hashed file names in the build (inlining of small assets is switched off, so a map is never a data URI). Each map in the bundle carries the resulting `imageUrl`.
- The output is one data bundle loaded at start, which keeps stepping and opening the journal instant. Images load lazily.
- Validation runs in the dev server while editing and in the GitHub publishing workflow before deployment, so a broken commit never replaces the live site. There is no separate standalone validate command.

### Validation rules

Errors (stop the build):
- Files and dates: an event file name doesn't match `year-month-day-order-slug.md`, or the month is outside 1 to 5 or the day outside 1 to 70; two events share the same year, month, day and order number; a required field is missing (an event title, or a journal entry's type or, except for locations, its name); a `location` journal entry's id doesn't match any location in `locations.json`; a location entry has a `name` field.
- Maps and locations: `maps.json` doesn't have exactly one `main` map, or a map's declared size doesn't match its image; a `location` or `showOn.location` id doesn't exist; a location has no position on the map it is used for, or a position is outside 0 to 100 percent; an event has `n/a` on the main map and no `showOn`.
- Languages: `campaign.json` doesn't define a default language that is one of its languages; a configured language lacks an era name, an abbreviation, five month names and in-date forms, or a date format; a language map or `@` section uses a language that isn't configured; a text field or section is repeated for the same language; a field or body has no default-language text; unmarked text is combined with an explicit section for the default language; a text in `ui.json` has no default-language value.
- Event fields: an event file has no front matter block; `location` and `position` are both given, or neither; a `position` is not `[x, y]` with both values from 0 to 100; `showOn` names a map that does not exist or the main map, has neither a `location` nor a `position`, or has `location: n/a`; `track` is not text; `newSegment` is not true or false. The month limit is the number of months in `campaign.json` and the day limit is its `daysPerMonth`. `n/a` is read in any letter case. An empty events folder is allowed, a missing one is an error, and every file in it must match the event file name pattern.
- Links and references: a `[[id]]` link or a `:::journal{for="..."}` id doesn't match any journal entry (checked in every language section); an image or map file doesn't exist; raw HTML appears in the text.

Warnings (the build continues):
- An ordinary image is over about 1 MB or 1600 px wide, or isn't JPEG, PNG or WebP.
- A map image is over about 10 MB or 5000 px wide, or isn't JPEG, PNG or WebP. Maps have their own, higher limit than ordinary images.
- An image, location or journal entry is never used.
- An event is `n/a` on the main map but its `showOn` location has a position on the main map, which is probably a location that was meant to be the event's main location.
- An image has empty alt text.
- A split `track` has no later event returning to the party.
- Missing translations are reported as one summary line per language, for example "English: 12 of 40 events have no text", not as a warning per item.

A `track` value is free text and is not checked against the journal, so a mistyped name creates a new track. The "never returns to the party" warning is the only safeguard.

## Application architecture

- State: the URL is the single source of truth for the current event, the active map, the open journal entry and the language, read through React Router's hash router. The back button, a reload and later shareable links work without a second copy of the state. Map pan and zoom stay as local component state.
- Layout on desktop: the map fills the upper area, with the stepper and the event details (title, date, text, images and previous/next controls) in a lower panel, like Wheel of Timelines. The event panel has a fixed height. The previous and next buttons have a row of their own at its top, so they stay in one place, and the rest of the panel scrolls below them, so the map keeps its size from event to event, and the map refits whenever its area changes size. The journal panel slides in from the right over the main view. On a phone the journal panel covers the screen.
- Styling: plain CSS with CSS Modules, so styles are scoped per component and a custom fantasy look is easy to build.
- Map switching: a manual map switch lasts only until the next step. Stepping always shows the new event on its own map.

URLs (hash router):
- `/#/event/<event-id>`: the main view at that event; the id is the file name without `.md`.
- `/#/event/<event-id>?map=haestra`: the same, with a manual map switch applied.
- `/#/event/<event-id>?journal=aldric`: the journal panel open over that event.
- `/#/event/<event-id>?lang=en`: the same event in English. `lang` can be combined with `map` and `journal`, and a missing or unknown value means the default language.
- `/#/journal`: the journal index open, over the current event.
- `/#/` redirects to the first event.

Components:
- App and router: reads the URL and provides the content bundle to everything below.
- MainView: the map area plus the lower panel.
  - MapView: the Leaflet map for the active map, with a MapSwitcher, location markers, route lines and the current event's marker.
  - StepperPanel: previous/next controls, plus EventDetails (title, date, the location as a link when it has a journal entry, rendered text, images).
- LanguageSwitch: the FI | EN control, which changes only the `lang` parameter in the URL. It sits at the top right of the main view, next to the JournalButton.
- JournalButton: top right of the main view, opening the journal index from the same side the panel slides in from. It may later be styled as a book.
- JournalPanel: the sliding panel, showing either the JournalIndex (grouped by type) or a JournalEntry (image, text, "In the campaign" excerpts, linked events).
- ImageViewer: full-size view when an image is clicked.
- Shared logic without UI: a route builder (the per-map, per-track route rules), a date formatter (per language), a text resolver (the chosen language, falling back to the default) and a coordinate converter (percent to Leaflet).

Map markers: the map shows the current event's marker prominently, plus small dots for the places visited so far on that map. Places the story hasn't reached yet are not shown. An event's place on a map is: on the main map its main place (its `location` or `position`, none for `n/a`), on the `showOn` map its `showOn` place, and on any other map the first of its named locations (`location`, then `showOn.location`) that has a position on that map, or none. An explicit place wins over a position taken from a location, and a one-off position gives a place only on its own map. So a place visited anywhere is shown on every map where its location has a position. The dots are the places of the earlier events, in date order, that have a place on the displayed map (standalone events included), one dot per place and none at the current marker. Clicking a marker to select its events is a future improvement, not part of the first version.

## Data flow

At build time the Vite plugin turns the content files into one bundle containing:
- the campaign settings, the interface texts, the maps and the locations;
- all events in date order, each with its date, title and rendered HTML text in every language it has, image references, and resolved main-map position and optional `showOn` position;
- all journal entries, each with its rendered text in every language it has, its image, its "In the campaign" excerpts (the paragraphs and journal-only passages from events) and the ids of the events that link to it (for location entries, the events held at that location).

At runtime:
1. The app loads the bundle once at start.
2. The router reads the URL: an event id, an optional `map`, an optional `journal` and an optional `lang`.
3. The event id gives the current event's position in the ordered list. Previous and next move that position and update the URL.
4. The language is the `lang` value, or the default language. Every text shown is taken in that language, falling back to the default language where it is missing (see "Languages"). The bundle holds all languages, so switching language needs no download.
5. From the current event the app derives what is shown. The displayed map is the URL's `map` override if present, otherwise the event's `showOn` map, otherwise the main map. The markers and route lines for that map run up to and including the current event. The journal panel shows the entry or index named in the URL.

Map loading: the main map loads first. Once it and the first event are shown, the app downloads the other maps in the background, so switching to them is quick later. Maps are used at full size, with no resizing or tiling.

Routes are worked out at runtime, once when the app loads. A plain function builds all segments per map and track from the ordered events, and stepping shows the segments up to the current event. This is cheap for about 300 events, easy to unit-test, and keeps the route rules in the app code rather than the build plugin.

Route rules, using the places of an event on a map as defined under "Map markers":
- The party's route on a map joins consecutive party events (no `track`) that both have a place on it. A party event with no place on the map (`n/a` on the main map, or an event whose locations have no position there) breaks the route. Each visit to another map is its own segment. `newSegment` starts a new segment on every map. Two events in a row at the same position leave no zero-length line. Standalone events (`track: none`) are ignored.
- A split group's events are joined in date order among themselves only, and the party's events in between do not end the split. The group's line starts at the party's last event before the group's first event and ends at the first party event after the group's last event, which is where it rejoins. A start or an end is drawn on a map only when that party event has a place on it. A group with no later party event ends at its last event. A group that is split twice under one name is one line, unless `newSegment` or another name is used.
- Which lines are shown: a map has a setting `routes`, `history` or `visit`, and the main map is `history` and every other map is `visit` by default. A history map shows all the segments up to the current event. A visit map shows, for each track, only the segment that holds the track's latest event up to the current one, and only if that event has a place on the map. So the route of a track begins when it enters a fine map and is no longer shown once it has left, and the visited places stay as dots.
- Drawing: the party's line is solid, and each group's line is dashed in its own colour from a fixed palette. Lines are drawn below the dots and the current marker.

Bad links: if the URL names an event that doesn't exist, the app shows the first event with a dismissible notice. The address is replaced with the first event's, and the notice is carried in the history entry's state, so dismissing it does not change the address and it does not come back on reload after being dismissed. If it names a journal entry that doesn't exist, the entry is ignored and the event is shown. The app never shows a blank screen.

## Deployment

- Publishing: a GitHub Actions workflow runs on every push to the `master` branch. It installs dependencies, runs the tests and the content validation, builds the site and deploys it with GitHub's official Pages action. Nothing built is committed to the repository, and a failed validation never replaces the live site.
- The site uses an existing public repository, `https://github.com/tmikonen/kulthea`, separate from the Jekyll blog. Its default branch is `master` and it already holds the three map images. GitHub Pages is not yet enabled; it must be switched on in the repository settings with the source set to "GitHub Actions".
- The `specifications` folder stays in the repository.
- The three existing maps are in `content/maps/` and are used as they are: `bay-of-izar.jpg` (1.3 MB, 2930 x 1858, the main map), `bog-end.jpg` (1.3 MB, 4042 x 2611) and `haestra.jpg` (8.1 MB, 4503 x 3147). Maps have their own, higher limit (see "Validation rules"), so they do not trigger the ordinary image warning. The 3 s load target applies to the main map and the first event, with the other maps loading afterwards in the background. The risk is that the 8 MB `haestra.jpg` competes for bandwidth on a slow connection and that very old phones struggle to decode it, to be checked by hand on the deployed site.
- Address: the project site `https://tmikonen.github.io/kulthea/`, which leaves the Jekyll blog untouched. The app is built with `/kulthea/` as its base path. A custom domain is not planned.

## Testing approach

- Logic and components: Vitest and React Testing Library. Vitest covers the pure logic (route rules, date handling, coordinate conversion, the content parser and validator, journal excerpts). React Testing Library covers component behaviour such as the stepper and the journal panel.
- Browser tests: Playwright against the built site, for the key flows, because Leaflet and layout do not work properly in a simulated environment. These check the main acceptance criteria: stepping updates the map, the journal panel keeps the event and map position, the back button and Escape close the panel, and a phone-sized screen works.
- Fixtures: a small handcrafted miniature campaign (a few events, two maps, a split track, a journal-only passage, an `n/a` event, an event translated into English and one that is not) is used by the tests instead of the real content. Test names include requirement ids such as FR-5, so it is visible which acceptance criteria are covered.
- Performance: the 200 ms stepping target is measured in Playwright. The 3 s first-load target depends on the real maps, so it is checked by hand against the deployed site.
- The validator is tested too, with cases for each error and warning in the validation rules.
- The tests run in the publishing workflow before the build is deployed.
- Test content: the content folder is configurable (the environment variable `CONTENT_DIR`, default `content`), so the browser tests build the site from the fixtures in `tests/fixtures/` instead of the demo content. The focus-zoom tests have a small fixture set of their own, `tests/fixtures-focus/`, built into a second site, so that the other browser tests keep a main map without a focus zoom.

## Technology stack

- App: React, TypeScript (strict), Vite and CSS Modules.
- Map: Leaflet through react-leaflet. Routing: React Router with the hash router.
- Content pipeline (the Vite plugin): unified and remark for Markdown (`unified`, `remark-parse`, `remark-rehype` and `rehype-stringify`, which produce the HTML at build time), with a directive plugin for the `:::journal` blocks, a YAML front-matter parser (the `yaml` package, with the front matter block split off by our own code) and a small library that reads image dimensions. The exact packages are chosen when the backlog item that needs them is implemented.
- Quality: Vitest, React Testing Library, Playwright, and ESLint with TypeScript support.
- No other runtime libraries are added without agreement with the product owner.

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

### DD-5 Languages: one file per item, all languages inside

Decision: Finnish and English are supported, with Finnish as the default. Every item is a single file holding all its languages: short fields as language maps, long text as `@fi` / `@en` sections, interface texts in one `ui.json`. The language is a `lang` query parameter in the URL.

Reasons:
- The content author requires one file per event, entry or location, with the content for all languages in it.
- It follows the same philosophy as the rest of the design: structure is written once in the file, the default language is always complete, and everything the visitor can change lives in the URL.
- A plain value or unmarked body means the default language, so starting in Finnish needs no language syntax, and English is added later by adding a map or a section.
- Missing translations fall back to the default language with a note, so the site is always complete.

Alternatives not chosen: a folder per language with mirrored files, language-suffixed files and complete parallel files, all of which split an item across several files; a translation library such as i18next, which would add a dependency and a second way to store translations for a handful of short texts; a language prefix in the path, which changes every route; remembering the choice in the browser, which reintroduces stored state.

Consequences: files with both languages are longer and mix two languages in one editor, and the build must check each language section separately (links, images, `:::journal` blocks).

### DD-6 Content layout: hybrid JSON and Markdown

Decision: short structured data (the campaign settings, interface texts, maps and locations) is stored as JSON. Each event and each journal entry is its own Markdown file with front matter (for events: title, locations, track; the date comes from the file name) followed by the prose.

Reasons: long descriptions are pleasant to write and review in Markdown files, one file per item keeps Git diffs small, and compact tabular data is clearer in JSON than in front matter.

Consequences: a build step reads both formats, validates them against the "Validation rules" (dates, N/A rules, broken links, image limits), and fails with a clear message.
