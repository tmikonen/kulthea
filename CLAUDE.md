# Kulthea Campaign Chronicles

An interactive timeline and map website for a Shadow World (Kulthea) role-playing campaign set in Haestra. Events are shown on map images, stepped through in date order, with a journal of characters, items, locations and notes. It is a static React + Vite + TypeScript site published to GitHub Pages at `https://tmikonen.github.io/kulthea/`. The campaign content is Finnish first, with optional English.

The product owner is the DM, who writes the content and accepts the work. Claude does the implementation.

## Where the instructions are

Read these before doing anything, in this order:
1. `specifications/REQUIREMENTS.md`: what to build, as requirements FR-1 to FR-9 with acceptance criteria.
2. `specifications/DESIGN.md`: how it is built, with the file formats, validation rules, architecture and the decision record (DD-1 to DD-6, with the reasons).
3. `specifications/BACKLOG.md`: the ordered work items, their statuses and the definition of done. This is the source of truth for what to do next and what is finished.

If code and documents disagree, stop and sort it out with the product owner. Never let them drift: when implementation requires a change to a requirement or a design decision, update the documents in the same commit and tell the product owner.

## How to work

- Work on one backlog item at a time, in the order of `BACKLOG.md`. Continue an item that is `in progress`; otherwise take the first item with status `defined`. Do not start an item with status `backlog`: it must first be refined into a defined item with the product owner.
- Set the item to `in progress` when you start. Write the tests together with the code, and keep each change small.
- An item is `done` only when its definition of done in `BACKLOG.md` is met: all acceptance criteria hold, all new and existing tests pass (`npm test`, `npm run typecheck`, `npm run lint`, and `npm run test:e2e` for browser behaviour), the code is committed, and its status is updated.
- Only the product owner sets `accepted`. After finishing an item, tell the product owner what to expect to see and which "how to check by hand" steps to run. Do not call work complete without running the tests and showing the result.
- If something is unclear or a decision is the product owner's to make, ask. Prefer asking over guessing, and give a recommendation with the trade-off.
- Keep the scope to the item. Do not add features, abstractions or error handling that the item does not need.

## Git

- Work on `master` and commit when an item is done and its tests pass, with the message `B-<n>: <title>`. Make smaller commits inside an item when useful, with clear messages.
- Do not push. The product owner pushes, because pushes to `master` publish the site.
- Commit messages never contain a `Co-Authored-By` line or any other mention of Claude. This is also set in `.claude/settings.json`, and it applies to pull request descriptions too.
- Never change git configuration. If `user.name` or `user.email` is not set, ask the product owner before committing.
- Never rewrite history or force push unless explicitly asked.
- Stage files by name, not with `git add -A`, and never commit secrets.

## Language

- Code, identifiers, file names, comments, commit messages and all documents are in English.
- Only the campaign content and the interface texts for Finnish users are in Finnish. The demo content is Finnish (the default language), with English on some items.

## Environment

- The product owner uses Windows with Git Bash. Use forward slashes in commands, and avoid commands that only work on Linux or macOS.
- Node.js current LTS and npm. Use `npm`, not pnpm or yarn.
- Dev server: `npm run dev`, then `http://localhost:5173/kulthea/`. The base path is `/kulthea/`.
- Commands (they exist once item B-1 is done): `npm test` (Vitest), `npm run test:e2e` (Playwright against the built site), `npm run typecheck`, `npm run lint`, `npm run build`.

## Conventions

- TypeScript in strict mode. Styling with plain CSS and CSS Modules, with no CSS framework.
- Content (events, journal, JSON) lives in `content/`. Tests use their own fixtures in `tests/fixtures/` and never depend on the demo content in `content/`.
- Content is Markdown only: raw HTML is not allowed. Content errors must fail the build with a message that names the file and the problem, and warnings must not. See the validation rules in `DESIGN.md`.
- The content folder is set by the environment variable `CONTENT_DIR` (default `content`). Browser tests build the site from `tests/fixtures/`.
- All positions are percentages of an image, `[x, y]` from the top-left, and are converted to Leaflet coordinates in one function.
- The URL (hash router) holds the state: current event, `map`, `journal` and `lang`. Do not keep a second copy of that state.
- Every text shown to the user comes from the content or from `ui.json`, resolved in the chosen language with fallback to the default language. Do not hard-code user-facing strings in components.
- Do not add libraries beyond the technology stack in `DESIGN.md` without asking.

## Repository

- Remote: `https://github.com/tmikonen/kulthea.git`, branch `master`, public. Publishing is a GitHub Actions workflow that runs the tests and the content validation before deploying.
- The three maps are in `content/maps/`: `bay-of-izar.jpg` (main), `bog-end.jpg` (finer scale) and `haestra.jpg` (largest scale). They are used as they are.

## If this session is lost

Start a new session in the repository root and read this file and the three documents above. `BACKLOG.md` shows what is `done`, `in progress` and `defined`, and `git log` shows what was committed. Check that the working tree is clean and the tests pass before continuing with the first unfinished item.
