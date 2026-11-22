# Workout App — where files go

Everything for this app stays inside this folder (`/Users/jacob/Desktop/LAYOR APPS/Workout App/`).
Jacob's Desktop was getting cluttered, and on 2026-10-27 he asked for this: do not create files or
folders for this project on the Desktop, in `~/Downloads`, in `/tmp`, or in the session scratchpad
directory. This overrides the default of using the scratchpad for temporary files.

| What | Where |
|---|---|
| Throwaway work: test copies, renders, recordings, logs, anything pulled off the phone | `scratch/` (git-ignored). Delete what you made when the job is done. |
| Reusable scripts | `scripts/`. `scripts/bump-version.sh <from> <to>` bumps `?v=` in `index.html` and `VERSION` in `service-worker.js`. App Store release: `scripts/asc-status.py`, `scripts/asc.py` (one API call), `scripts/asc-listing.py`, `scripts/appstore-profiles.py`, `scripts/release.sh`, `scripts/make-icon.sh` (draws and installs the app icon; keys in the git-ignored `scripts/.asc-env`); listing text and checklist in `APP-STORE.md`. |
| Swift test and render harnesses | `ios/tests/` (not part of the Xcode project) |
| Steps and Goals dashboards | the arithmetic is `dash.js` (pure functions, loaded before `app.js`; `node scripts/test-dash.mjs` checks it), the drawing is in `app.js` under "Steps dashboard" and "The card both kinds of goal share", the styles in `styles.css` under "Dashboards". A new top-level name in `app.js` must not be one Capacitor injects (`nativeBridge`). |
| Store screenshots | `store/screenshots/` (git-ignored output), made by `node scripts/screenshots.mjs` from the demo data in `scripts/screenshots/`. `DEV=1 ONLY=03-steps node scripts/screenshots.mjs` writes full-length pages to `scratch/dev-shots` instead, and `python3 scripts/demo-page.py` writes a demo-data page for the browser preview or the Simulator's Safari (both into git-ignored `scratch/`). |
| Reference guides | the project root, beside `CAPACITOR.md` |
| Builds | `ios/build` (device), `ios/build-sim` (simulator), `www/` (web copy). Pass `-derivedDataPath` inside the project. |

This table is the layout for this project. The global rule in `~/.claude/CLAUDE.md` suggests a
root-level `build/` folder; here `scratch/` and the `ios/build*` folders take its place (`package.json`
depends on `ios/build`), so do not add a second `build/` folder.

The GitHub repo is public and Vercel serves the repo root. Never put copies of Jacob's data (phone
databases, exports, workout screenshots) anywhere tracked, and read `git status` before every commit.
