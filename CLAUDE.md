# Workout App — where files go

Everything for this app stays inside this folder (`/Users/jacob/Desktop/LAYOR APPS/Workout App/`).
Jacob's Desktop was getting cluttered, and on 2026-10-27 he asked for this: do not create files or
folders for this project on the Desktop, in `~/Downloads`, in `/tmp`, or in the session scratchpad
directory. This overrides the default of using the scratchpad for temporary files.

| What | Where |
|---|---|
| Throwaway work: test copies, renders, recordings, logs, anything pulled off the phone | `scratch/` (git-ignored). Delete what you made when the job is done. |
| Reusable scripts | `scripts/`. `scripts/bump-version.sh <from> <to>` bumps `?v=` in `index.html` and `VERSION` in `service-worker.js`. App Store release: `scripts/asc-status.py`, `scripts/asc.py` (one API call), `scripts/asc-listing.py`, `scripts/appstore-profiles.py`, `scripts/release.sh`, `scripts/make-icon.sh` (draws and installs the app icon; keys in the git-ignored `scripts/.asc-env`); listing text and checklist in `APP-STORE.md`. |
| Swift test and render harnesses | `ios/tests/` (not part of the Xcode project). `scripts/widget-render.sh` renders the Home Screen widget (small and medium, dark and light, ten states) to PNG on the Mac, with contact sheets, into `scratch/widget-render`. |
| Steps tab, and the Goals tab with its Analytics view | the Steps tab is today against the daily goal plus the long-term goal card; every chart and figure lives in Goals > Analytics. The arithmetic is `dash.js` (pure functions, loaded before `app.js`; `node scripts/test-dash.mjs` checks it), the drawing is in `app.js` under "Steps dashboard" and "The card both kinds of goal share", the styles in `styles.css` under "Dashboards". A new top-level name in `app.js` must not be one Capacitor injects (`nativeBridge`). |
| Store screenshots | `store/screenshots/` (git-ignored output), made by `node scripts/screenshots.mjs` from the demo data in `scripts/screenshots/`. `DEV=1 ONLY=03-steps node scripts/screenshots.mjs` writes full-length pages to `scratch/dev-shots` instead, and `python3 scripts/demo-page.py` writes a demo-data page for the browser preview or the Simulator's Safari (both into git-ignored `scratch/`). |
| Reference guides | the project root, beside `CAPACITOR.md` |
| Builds | `ios/build` (device), `ios/build-sim` (simulator), `www/` (web copy). Pass `-derivedDataPath` inside the project. |

This table is the layout for this project. The global rule in `~/.claude/CLAUDE.md` suggests a
root-level `build/` folder; here `scratch/` and the `ios/build*` folders take its place (`package.json`
depends on `ios/build`), so do not add a second `build/` folder.

**App Store Connect is hands-off unless Jacob asks** (his words, 2026-11-22: "don't keep updating the App Store version
unless I ask for it"). Do not upload builds, swap screenshots or edit the listing, review details or version on your own
initiative, even after the app changes. Pushing the web app and installing on his own phone are fine.

The GitHub repo is public and Vercel serves the repo root. Never put copies of Jacob's data (phone
databases, exports, workout screenshots) anywhere tracked, and read `git status` before every commit.
