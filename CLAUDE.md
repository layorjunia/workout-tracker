# Workout App — where files go

Everything for this app stays inside this folder (`/Users/jacob/Desktop/LAYOR APPS/Workout App/`).
Jacob's Desktop was getting cluttered, and on 2026-10-27 he asked for this: do not create files or
folders for this project on the Desktop, in `~/Downloads`, in `/tmp`, or in the session scratchpad
directory. This overrides the default of using the scratchpad for temporary files.

| What | Where |
|---|---|
| Throwaway work: test copies, renders, recordings, logs, anything pulled off the phone | `scratch/` (git-ignored). Delete what you made when the job is done. |
| Reusable scripts | `scripts/`. `scripts/bump-version.sh <from> <to>` bumps `?v=` in `index.html` and `VERSION` in `service-worker.js`. App Store release: `scripts/asc-status.py`, `scripts/appstore-profiles.py`, `scripts/release.sh` (keys in the git-ignored `scripts/.asc-env`); listing text and checklist in `APP-STORE.md`. |
| Swift test and render harnesses | `ios/tests/` (not part of the Xcode project) |
| Store screenshots | `store/screenshots/` (git-ignored output), made by `node scripts/screenshots.mjs` from the demo data in `scripts/screenshots/` |
| Reference guides | the project root, beside `CAPACITOR.md` |
| Builds | `ios/build` (device), `ios/build-sim` (simulator), `www/` (web copy). Pass `-derivedDataPath` inside the project. |

This table is the layout for this project. The global rule in `~/.claude/CLAUDE.md` suggests a
root-level `build/` folder; here `scratch/` and the `ios/build*` folders take its place (`package.json`
depends on `ios/build`), so do not add a second `build/` folder.

The GitHub repo is public and Vercel serves the repo root. Never put copies of Jacob's data (phone
databases, exports, workout screenshots) anywhere tracked, and read `git status` before every commit.
