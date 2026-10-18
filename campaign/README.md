# Campaign content (draft)

The real campaign content, drafted from the GM notes. It is a separate content folder, so the demo content in `content/` stays free for technical testing. Use it with `CONTENT_DIR=campaign` (for example `CONTENT_DIR=campaign npm run dev`). Item B-32 replaces the demo content with this folder.

- `campaign.json`, `ui.json` and `locations.json` start as copies of the files in `content/`, so a change to one of them has to be made in both until B-32. `locations.json` also has the places that only the campaign uses (Sammal's Sheep Farm).
- `maps.json` points to the map images in `content/maps/`, so the images are not duplicated.
- Events are in `events/`, in the format described in `specifications/DESIGN.md`. The event reader (B-8) validates them with the same rules as the demo events.

## Dates

- The 2021 session starts at the old watchtower on TE 6052, 21st of Spring (`6052-2-021`). That date is confirmed.
- Dates set by the product owner: the troll cave events (the attack and the stone door) are one day after the watchtower, TE 6052, 22nd of Spring (`6052-2-022`); the night at Sammal's farm is one day after that, the 23rd (`6052-2-023`); the return to Bentara is seven days after the farm, the 30th (`6052-2-030`). The order number counts the events of one day.
