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

## Apple Health sync (Shortcut → Gist → app)

The app reads HR, sleep, active energy and steps from a private GitHub Gist
that you (the iPhone) keep up to date via an Apple Shortcut. No backend
server, no app review — runs entirely between Shortcuts and GitHub.

### Expected gist file shape (`health.json`)

```json
{
  "updatedAt": "2026-05-24T14:30:00Z",
  "restingHR": 58,
  "sleepHours": 7.3,
  "activeEnergyToday": 642,
  "stepsToday": 8420
}
```

The app fetches this file (5-min in-app cache, plus a "Refresh" button on
the Health tab) and shows the values next to your macros.

### One-time setup

#### 1. Create a GitHub personal access token

1. github.com → top-right avatar → **Settings** → **Developer settings**
   → **Personal access tokens** → **Tokens (classic)** → **Generate new
   token (classic)**.
2. Note: `iPhone Health sync`. Expiration: whatever you're comfortable
   with (90 days–no expiration). Scopes: tick **`gist`** only.
3. Generate and **copy the token** — you'll only see it once.

#### 2. Create the secret gist

1. gist.github.com → filename `health.json`, content `{}`.
2. Click **Create secret gist**.
3. Copy the long alphanumeric ID from the URL
   (`gist.github.com/<user>/<THIS_PART>`).
4. Open the workout app → **Settings** → **Apple Health sync** → paste
   that ID into the Gist ID field.

#### 3. Build the Apple Shortcut

Open Shortcuts on iPhone → **+** new shortcut, name it
"Sync Health". Add these actions in order:

| # | Action (search box) | Configure |
|---|---|---|
| 1 | **Current Date** | (defaults) |
| 2 | **Format Date** | Date Style: ISO 8601, Include Time: on. → Variable `now` |
| 3 | **Find Health Samples** | Sample type: **Resting Heart Rate**, Limit: 1, Sort by Date (newest first) |
| 4 | **Get Numerical Value from Health Sample** | (from previous) → Variable `restingHR` |
| 5 | **Find Health Samples** | Sample type: **Sleep Analysis**, Date in: Last 1 Day |
| 6 | **Calculate Statistic** → **Total duration in hours** | → Variable `sleepHours` |
| 7 | **Find Health Samples** | Sample type: **Active Energy**, Date in: Today |
| 8 | **Calculate Statistic** → **Sum** | → Variable `activeEnergy` |
| 9 | **Find Health Samples** | Sample type: **Steps**, Date in: Today |
| 10 | **Calculate Statistic** → **Sum** | → Variable `steps` |
| 11 | **Dictionary** | Build this structure: `updatedAt = now`, `restingHR = restingHR`, `sleepHours = sleepHours`, `activeEnergyToday = activeEnergy`, `stepsToday = steps` |
| 12 | **Get Contents of URL** | URL: `https://api.github.com/gists/<YOUR_GIST_ID>`, Method: **PATCH**, Headers: `Authorization: token <YOUR_PAT>`, `Accept: application/vnd.github+json`, Request Body: JSON →`{ "files": { "health.json": { "content": "<dict-as-text>" } } }` (use **Get Text from Dictionary** to serialize the dictionary first; pass that into the inner `content` field as a string) |

Tap ▶ to test once. Open gist.github.com, confirm the JSON updated.

#### 4. Run it on a schedule

Shortcuts → **Automation** → **+** → **Personal Automation** → **Time of
Day**:

- Add four time-based triggers: 7:00 AM, 12:00 PM, 6:00 PM, 10:00 PM
- Action: **Run Shortcut** → choose "Sync Health"
- **Turn off** "Ask Before Running" so it fires silently

Now the gist updates four times a day. The app pulls fresh data on launch
and on demand via the **Refresh from Gist** button on the Health tab.

#### Notes / gotchas

- Resting HR refreshes once a day on Apple Watch — checking it 4× is
  redundant but harmless.
- Sleep Analysis from "Last 1 Day" gives last night's sleep until ~6 PM
  the next day. Adjust to "Last 2 Days" and take the most recent block if
  you want fresher numbers.
- If the gist stops updating, regenerate the token (it likely expired)
  and update the Shortcut's PATCH action with the new value.
- Trends / multi-day charts aren't in v1 — only the latest snapshot is
  displayed. The Shortcut can be extended to write a `history` array if
  you want that later.

## Tweaking the seed library

The pre-loaded exercises live in `app.js` inside the `SEED` constant. To
add or rename one permanently (so a fresh device gets it too), edit
`SEED`. For just-for-you changes, use **Library → New** or tap an existing
exercise to edit it.
