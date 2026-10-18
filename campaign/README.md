# Campaign content (draft)

The real campaign content, drafted from the GM notes. It is a separate content folder, so the demo content in `content/` stays free for technical testing. Use it with `CONTENT_DIR=campaign` (for example `CONTENT_DIR=campaign npm run dev`). Item B-32 replaces the demo content with this folder.

- `campaign.json`, `ui.json` and `locations.json` start as copies of the files in `content/`, so a change to one of them has to be made in both until B-32. `locations.json` also has the places that only the campaign uses (Sammal's Sheep Farm).
- `maps.json` points to the map images in `content/maps/`, so the images are not duplicated.
- Events are in `events/`, in the format described in `specifications/DESIGN.md`. The event reader (B-8) validates them with the same rules as the demo events.

## Dates

- The 2021 session starts at the old watchtower on TE 6052, 21st of Spring (`6052-2-021`). That date is confirmed.
- Dates set by the product owner (B-43, B-44): Belladonna hires the party at Bentara on the 12th of Spring (9 days before the watchtower, the first event of the party's route); the watchtower is on the 21st (`6052-2-021`); the two troll cave events are on the 22nd; the night at Sammal's farm and the arrival in Lean are on the 23rd (the farm first); the return to Bentara is on the 30th. The order number counts the events of one day.
