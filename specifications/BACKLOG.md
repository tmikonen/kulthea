# Campaign Chronicles: Backlog

Tasks for step-wise implementation and testing, in the order they should be done. Each item names the requirements and design sections it relates to, states when it is done, and lists open decisions. Requirement ids (FR-n) refer to `REQUIREMENTS.md`, and section names refer to `DESIGN.md`.

Status values: todo, in progress, done.

## B-1 Handle the maps

Status: todo

Related: FR-1, "Positions", "File formats" (`maps.json`), "Validation rules", Non-functional requirements (performance, images), "Deployment" (map sizes).

Background: the repository already holds three maps in `content/maps/`.

| File | Size | Pixels |
|---|---|---|
| `haestra.jpg` | 8.1 MB | 4503 x 3147 |
| `bog-end.jpg` | 1.3 MB | 4042 x 2611 |
| `bay-of-izar.jpg` | 1.3 MB | 2930 x 1858 |

These are far above the general image limits (about 1 MB, 1600 px wide), and the largest is about 8 times the size limit. The examples in the design use the ids `main`, `fine` and `world`, which do not match these files. The 3 s first-load target is at risk with an 8 MB first image.

Decisions needed:
- Which map is the main map, which is the fine-scale map, and which is the largest-scale map? What are the map ids and display names?
- Size policy for maps: a separate, higher limit for maps than for other images, or resizing to a web size, or splitting a large map into tiles.
- If the maps are resized: where the full-size originals are kept, and whether the page offers the full-resolution version when zoomed in.
- How the first-load time is measured, and what is acceptable.

Done when:
- the three maps have agreed ids and names, and `content/maps.json` describes them with their real pixel sizes;
- the agreed size policy is written into `REQUIREMENTS.md` and `DESIGN.md` (non-functional requirements and "Validation rules"), and the build's image warnings treat maps according to it;
- the first map loads within the 3 s target on broadband when served from GitHub Pages, checked by hand;
- the documents' examples use the real map ids and file names.
