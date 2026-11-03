# App Store release: Workout Tracker

Draft listing text and the submission checklist. Nothing here has been entered into App Store
Connect yet. Scripts: `scripts/asc-status.py` (read-only look at the account), `scripts/appstore-profiles.py`
(signing profiles), `scripts/release.sh` (`--archive-only`, default = signed export, `--upload`).

## Decide before the app record is created

- **Name.** 30 characters max and unique across the whole App Store; "Workout Tracker" is almost
  certainly taken. The name under the icon on the Home Screen stays "Workout Tracker".
- **Seller name.** The App Store shows the developer account's legal name: "Illuminate Drones, LLC".
- **Price.** Free (no bank or tax forms needed).

## Listing text

| Field | Text |
|---|---|
| Subtitle (30) | Lifts, steps, goals, streaks |
| Category | Health & Fitness |
| Age rating | 4+ (answer "None" to every content question) |
| Promotional text (170) | Log every set, watch your progress charts, and hit your daily step goal. A Home Screen widget keeps your streak in sight. |
| Keywords (100) | workout,gym,lifting,log,tracker,steps,streak,goals,fitness,strength,sets,reps,progress,widget |
| Support URL | https://layorjunia-workouts.vercel.app/support.html |
| Privacy policy URL | https://layorjunia-workouts.vercel.app/privacy.html |
| Copyright | 2026 Illuminate Drones, LLC |

**Description**

Workout Tracker is a fast, no-nonsense log for lifting and daily activity.

- Log workouts from templates you can edit: sets, reps, weight, time and cardio.
- See your progress: estimated 1RM, volume, personal records and a chart for every exercise.
- Steps and streaks: reads your steps from Apple Health, tracks a daily goal and a streak, and shows both in a Home Screen widget.
- Goals with medals: set a rep or step total and earn a medal at every 10%, with daily rings showing what today needs.
- Body and nutrition: weight trends, plus protein, carbs and fat from Health.
- Your log is saved on your phone first, so spotty gym Wi-Fi never loses a set. Sign in (optional) to sync across devices with a name and a 4-digit PIN, and delete your account in Settings any time.
- Private: no ads and no tracking.

Workout Tracker is a general fitness log, not medical advice.

## Notes for App Review

> Workout Tracker is a native iPhone app with Apple Health (HealthKit) integration, a Home Screen
> widget (WidgetKit) and haptic feedback. Its screens are served from our own website over HTTPS
> inside the app's web view.
>
> No account is needed to log workouts. To try the Health features, open Settings → Cloud sync, enter
> any name and a 4-digit PIN (for example "applereview" and 1234), tap "Sign in / Create account",
> then allow Health access. Steps, streak and goals then show on the Steps and Goals tabs and in
> the widget.
>
> To test account deletion: Settings → Cloud sync → Delete account, then enter the same PIN.
>
> The app only reads from Health; it never writes to it.

## App Privacy answers (draft: check against the app before submitting)

Tracking: none. Everything below is collected only if the person signs in, is linked to their
account, and is used for App Functionality.

- Health & Fitness: Health (heart rate, sleep, steps, body measurements), Fitness (workouts)
- Contact Info: Email Address (the placeholder address, or a real one if they typed one)
- Identifiers: User ID
- User Content: Other User Content (workout logs and notes)

Not collected: location, contacts, browsing or search history, purchases, usage data, diagnostics.

## Screenshots

iPhone 6.9-inch, 1320 x 2868, 3 to 10 images. No iPad set is needed (the app is iPhone-only). Use
demo data, never real workouts.

## Checklist

| # | Step | Who | State |
|---|---|---|---|
| 1 | Accept Apple's updated Program License Agreement (Account Holder, developer.apple.com/account) | Jacob | waiting |
| 2 | Create the app in App Store Connect (the API cannot) | Jacob | waiting |
| 3 | In-app account deletion (required by App Review 5.1.1(v)) | done | in working copy |
| 4 | First-launch fix: a new install now starts with a complete state, and no personal goals | done | in working copy |
| 5 | Privacy policy and support pages, in-app links | done | in working copy |
| 6 | iPhone-only, privacy manifests, encryption flag, clearer Health wording | done | built and checked |
| 7 | Deploy the web changes (`git push`): App Review loads the live site, so this comes before submitting | needs Jacob's OK | |
| 8 | Screenshots from the simulator with demo data | Claude | |
| 9 | `scripts/appstore-profiles.py`, then `scripts/release.sh --upload` | Claude | blocked on 1 and 2 |
| 10 | Fill in the listing, attach the build | Claude (API) | blocked on 2 |
| 11 | Answer App Privacy in App Store Connect (the API cannot) | Jacob | |
| 12 | Submit for review, then release | Jacob's go-ahead | |

## Known gaps worth a decision

- Apple can reject apps that are only a website in a frame (guideline 4.2). The Health, widget and
  haptics features are the answer, and the notes above lead with them. If Apple pushes back, the fix is
  to bundle the site inside the app instead of loading it live.
- The Health permission is only requested after sign-in, so steps stay empty until a new person signs in.
  Asking when they first open the Steps tab would be friendlier.
- Accounts are a name and a 4-digit PIN. That is thin protection for health data once strangers use the
  app; Sign in with Apple would be stronger.
- New people start with the starter templates (Push, Pull, Legs, Mix, Rider Core, Rider Legs, Cardio) and
  the exercise library built from your routine.
