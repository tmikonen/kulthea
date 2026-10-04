# Campaign content (draft)

The real campaign content, drafted from the GM notes. It is a separate content folder, so the demo content in `content/` stays free for technical testing. Use it with `CONTENT_DIR=campaign` (for example `CONTENT_DIR=campaign npm run dev`). Item B-32 replaces the demo content with this folder.

- `campaign.json`, `ui.json` and `locations.json` start as copies of the files in `content/`, so a change to one of them has to be made in both until B-32. `locations.json` also has the places that only the campaign uses (Sammal's Farm).
- `maps.json` points to the map images in `content/maps/`, so the images are not duplicated.
- Events are in `events/`, in the format described in `specifications/DESIGN.md`. The event reader is added in B-8, so the events are not validated until then.

## Dates

- The 2021 session starts at the old watchtower on TE 6052, 21st of Spring (`6052-2-021`). That date is confirmed.
- The other four events of the session carry the same date with increasing order numbers. Only the order is from the notes, and the real days are to be set by the product owner.
