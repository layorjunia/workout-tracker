# Workout Tracker

A no-backend, mobile-first workout logger built for the gym. Pre-seeded
with Jacob's exercise library from the original Google Sheets plan.

- **Logs sets/reps/load**, auto-computes volume and Brzycki estimated 1RM
- **Week-over-week** progress charts (total volume, per-exercise volume,
  estimated 1RM) plus a WoW table
- **Day-template prefill** — pick "Day 1" and it loads the right exercises
- **localStorage only** — data lives in your browser
- **Export / Import JSON** for backups and moving between phone and laptop

## Run locally

```bash
cd "Workout App"
python3 -m http.server 8765
# then open http://localhost:8765
```

No build step. No dependencies installed locally — Chart.js loads from a CDN.

## Publish to GitHub Pages

1. **Create the repo and push:**
   ```bash
   cd "/Users/jacob/Desktop/Workout App"
   git init
   git add index.html app.js styles.css README.md
   git commit -m "Initial workout tracker"
   gh repo create workout-tracker --public --source=. --push
   ```
   (If you don't have `gh` installed, create the repo on github.com first
   and `git remote add origin …` + `git push -u origin main`.)

2. **Enable Pages:**
   - Open the repo on github.com → **Settings** → **Pages**
   - Source: **Deploy from a branch**
   - Branch: **main** / **root**
   - Save. After ~30s your app is live at:
     `https://<your-github-username>.github.io/workout-tracker/`

3. **Add to your phone's home screen** so it feels like an app:
   - Open the GitHub Pages URL in Safari (or Chrome on Android)
   - Share → "Add to Home Screen"
   - Tap the icon and the app opens full-screen, no browser chrome

## File layout

| File | Purpose |
| --- | --- |
| `index.html` | All views (Today / History / Progress / Library / Settings) |
| `app.js` | State, storage, calculations, rendering — all vanilla JS |
| `styles.css` | Mobile-first dark theme + responsive desktop breakpoint |
| `seed-exercises.json` | Reference data extracted from your original sheet |
| `Workout Plan - Jacob.xlsx` | The original spreadsheet (kept for reference) |

## How the numbers work

- **Set volume** = `load × reps`
- **Workout volume** = sum of all set volumes
- **Estimated 1RM (Brzycki)** = `load × 36 / (37 − reps)` — capped at the
  set's load if reps ≥ 37
- **Weeks** are ISO weeks (Monday-start), so a session on a Sunday counts
  toward the same week as the prior Monday

## Backing up

Settings → **Export JSON** drops a timestamped file. Stash it in iCloud /
Dropbox / Google Drive once a week and you're safe. **Import JSON**
restores from one of those files — it fully replaces your current data.

## Tweaking the seed library

The pre-loaded exercises live in `app.js` inside the `SEED` constant. To
add or rename one permanently (so a fresh device gets it too), edit
`SEED`. For just-for-you changes, use **Library → New** or tap an existing
exercise to edit it.
