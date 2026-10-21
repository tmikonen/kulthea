# The campaign content: an authoring guide

This folder is the real campaign, the content that the site publishes. It is plain files: Markdown for the texts and JSON for the settings, so you can write and change everything by hand, in any editor. This guide is for adding events, journal entries, pictures and links, and for trying a change and publishing it. It takes about ten minutes to read. The exact rules are in `specifications/DESIGN.md` ("File formats" and "Validation rules").

The texts are Finnish first. English is optional and can be added a little at a time.

## 1. What is where

```
content/
  campaign.json    the title, the languages, the calendar and the date format
  ui.json          the texts of the buttons and labels, in each language
  maps.json        the three maps (Izarinlahti, Suonperä, Haestra) and how they behave
  locations.json   the places, and their positions on each map
  maps/            the three map images
  images/          pictures for the journal and the events
  events/          one Markdown file for each event
  journal/         one Markdown file for each journal entry
```

The invented demo content, for developing the site, is in `demo/`. Use it with `CONTENT_DIR=demo npm run dev`. Do not put real events there.

## 2. Writing an event

An event is a file in `events/` named `year-month-day-order-slug.md`, for example `6052-2-052-02-kiviovi.md`:
- the year, the month number (1 Talvi, 2 Kevät, 3 Kesä, 4 Ruska, 5 Marras), the day (1 to 70), an order number for the events of the same day, and a short slug in lower case, with dashes;
- the date is only in the file name. Two events must not have the same date and order number.

The file begins with a front matter block between two `---` lines, and then the text:

```markdown
---
title: Kiviovi murtuu
location: troll-cave
---
[[og-og|Og-Og]] painoi olkapäänsä kiveä vasten.

[[bain-pitkavihainen|Bain]] hyppäsi kiven päälle.
```

The front matter has:
- `title`: a short text (required);
- `location`: the id of a place in `locations.json`, or `n/a` when the event has no place on the main map (then `showOn` is needed); or instead `position: [x, y]` for a one-off point (percent of the image, from the top-left);
- `showOn`: optional, to show the event on another map, for example `showOn: { map: bog-end, location: bog-end }`;
- `track`: optional. Leave it out for the party. A name means a group that has split from the party, and `none` means a standalone event that is not on the route (a background event);
- `newSegment: true`: optional, to draw no line from the previous event (a jump, a teleport).

In the text you write ordinary Markdown: paragraphs, `*italics*`, `**bold**`, lists, and `~~strikethrough~~`. Raw HTML is not allowed.

**Links to the journal:** `[[id]]` shows the entry's name, and `[[id|text]]` shows your own text, in the form that fits the sentence (`[[ilbo|Ilboa]]`). The id is the file name of the entry without `.md`.

**One sentence for a character:** a paragraph that links to a character is also shown in that character's entry, under "Kampanjassa". So give a sentence about a character its own paragraph.

**Journal-only passage:** text that appears only in a character's entry, not in the event:

```markdown
:::journal{for="marek-baalik"}
Marek epäili jo tässä, mutta ei kertonut kenellekään.
:::
```

**Languages:** text without a marker is Finnish. To add English, write the marker `@fi` before the Finnish text and `@en` before the English text, each on its own line, and a language map for the title: `title: { fi: ..., en: ... }`. Do not mix unmarked text with an `@fi` section: either mark all the text or none of it. A missing translation falls back to Finnish.

**A picture** goes in the text as `![Alt text](images/name.webp "Caption")`. The alt text describes the picture; the caption is shown under it. See section 4.

## 3. Writing a journal entry

An entry is a file in `journal/`, named with the id (`og-og.md`: lower case letters, digits and dashes). It has a front matter block and a text:

```markdown
---
type: npc
name: "Ilbo"
---
Puolituinen, perheenisä, kauppias. Viinaanmenevä.
```

- `type` is `pc` (player character), `npc`, `item`, `location` or `note`.
- `name` is a short text (not for a location: its name comes from `locations.json`).
- `image: images/name.webp` is an optional lead picture (the portrait of a character).
- `motto: "..."` is only for player characters.
- A location entry has the id of the place as its file name, and a text. The events held at the place are listed in it automatically, and the name of the place in an event becomes a link.
- The text is the background (for characters) or the description. The lists of events are made by the site.

An entry that no `[[link]]` mentions, and no event is held at, gets a warning. An entry that only has the placeholder "Kuvaus puuttuu vielä." is waiting for its description.

## 4. Pictures

Put a picture in `images/` and use its path, `images/name.webp`. Use only letters, digits, `.`, `_`, `-` and `/` in the name. A picture should be JPEG, PNG or WebP, at most about 1 MB and 1600 px wide; otherwise there is a warning. A picture of the GM's notes is prepared with `npm run notes:image -- <draft> <number> <name>`, which makes a small WebP file into the draft (see section 6).

## 5. Places and positions

The places are in `locations.json`, each with an id, a name (a plain text, or a text for each language) and its position on one or more maps as `[x, y]`, percent of the image from the top-left:

```json
{ "id": "lean", "name": "Lean", "positions": { "bay-of-izar": [60.2, 55.0] } }
```

To find the position, run `npm run dev` and open `http://localhost:5173/kulthea/place.html`. Choose a map and click: the page shows the position to copy, and a list of the places that have none on that map. The page is only in the development server and not in the published site.

## 6. The tools for the GM's notes

The notes are in `gm-notes/` (private, never published). The tools prepare proposals in `drafts/<name>/`, a folder laid out like this one with only the new or changed files:
- `npm run notes:split` prepares the notes into parts and pictures in `gm-notes/work/`.
- `npm run notes:image -- <draft> <number> <name>` converts a picture of the notes to a small WebP file in the draft.
- `npm run draft:links -- <draft> [--apply]` lists the names that could be `[[links]]` in the draft's Finnish texts, and with `--apply` writes the sure ones. A form of a name that it cannot work out (for example "Kultavuorten" for "Kultavuoret") goes to `drafts/<draft>/aliases.json`, as `{ "Kultavuorten": "kultavuoret" }`.
- `npm run draft:check -- <draft>` checks the draft over this content: errors, warnings, what is new and what changes (with a diff), and the open questions of the draft's `REVIEW.md` (the lines that start with `- [ ]`).
- `npm run draft:dev -- <draft>` shows the draft on the site.
- `npm run draft:apply -- <draft> [--overwrite]` copies the draft into this folder; a file that already exists needs `--overwrite`.

## 7. Errors and warnings

The build stops with an **error** that names the file and the problem: for example a link to an entry that does not exist, a place that is not in `locations.json`, a picture that is missing, a broken `[[link]]`, or a wrong date in a file name. Fix the file and run again.

A **warning** does not stop the build, but this folder is kept free of them. The usual ones: an entry, a place or a picture that nothing uses, a picture that is too large, a field that is not known (the message suggests the field you probably meant), and an empty alt text. The build also prints one line for each language that is not complete, for example how many events have no English text; it is only information.

## 8. Trying a change, and publishing

1. Run `npm run dev` and open `http://localhost:5173/kulthea/`. The site shows the change when you save a file, and errors and warnings are printed in the terminal.
2. Run `npm run test:all` to run the tests, the type check, the style check and the browser tests, and `npm run build` to build the site.
3. Commit the change.
4. Publishing is a push to the `master` branch on GitHub. A workflow runs the tests and the content check and, only if they pass, publishes the site at `https://tmikonen.github.io/kulthea/`. An error in the content stops the publishing, and the old site stays.

## 9. About the dates of the sessions

- **2021:** the first session starts at the old watchtower on TE 6052, 51st of Spring (`6052-2-051`). Belladonna hires the party at Bentara on the 42nd of Spring (the first event of the party's route); the two events at the troll cave are on the 52nd; the night at Sammal's farm and the arrival in Lean are on the 53rd (the farm first); the return to Bentara is on the 60th.
- **2022:** the party leaves Bentara on the 2nd of Summer (12 days after the return), arrives at Bog End on the 7th (5 days), camps at the swamp on the 8th, reaches the old temple and the kobolds on the 18th (10 days), solves the riddles on the 19th, and on the 20th enters the ice cave and fights the mentalist. The order number counts the events of one day.
- **2023:** the party rests 3 days at the Jinteni ruins and descends for 4 days, arriving at Bog End on the 27th of Summer; it stays 5 days in the village, and on the 31st Pjotr's invitation takes it to Count Kert's manor. The hunt of the cockatrice is on the 32nd and 33rd, and the return to the manor, and from there back toward Bog End, on the 34th.
- **2024:** the party spends a night at Suonperä on the 35th of Summer, arrives in Bentara on the 40th (the inn Svengaava Hirvi), the pact with Eissa and the healing of Bain's hand are on the 41st, and on the 51st (10 days later) the party is back at the portal in the ice cave and spends the whole day beyond it, all in one day. The order number counts the events of one day.
- **2025:** the party returns to Bentara on the 61st of Summer (4 days to Suonperä and 6 more, 10 days after the 51st), Dirhavel hires it on the 63rd, it meets the league in the tavern Örkinpää on the 64th, the battle at the warehouse is the next day, the 65th, and the arrest is in the early morning of the 66th, where the last event ends. The harvest festival at Suonperä has not happened yet.
