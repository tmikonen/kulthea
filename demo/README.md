# Demo content

This folder is the demo content, used for developing the site: `CONTENT_DIR=demo npm run dev` (or `npm run build`). The events in `events/` are invented: they all fall in the year TE 6000, their file names contain `demo-` and their titles start with "Demo:". The locations and the maps are the campaign's real places and maps; `maps.json` points to the images in `../content/maps/`, so that they are not duplicated.

The real campaign is in `content/` (see `content/README.md`). Do not put real events here.

The journal entries in `journal/` and the pictures in `images/` are invented too. Their ids start with `demo-` and their names with "Demo:", except for the location entries (`ancient-jinteni-ruins`, `bog-end`, `troll-cave`), whose ids must be those of the real locations they describe, so only their text is invented. The pictures are generated placeholders.
