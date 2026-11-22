# App Store release: Sets & Steps

The app record exists (Apple ID 6830320969). The listing text below is a draft until it is entered in
App Store Connect. Scripts: `scripts/asc.py` (any one API call), `scripts/asc-status.py` (read-only look at the account), `scripts/appstore-profiles.py`
(signing profiles), `scripts/release.sh` (`--archive-only`, default = signed export, `--upload`).

## Decided

- **Name.** Sets & Steps (30 characters max, unique across the App Store; "Workout Tracker" was taken).
  The label under the icon on the Home Screen is the same. The name stays editable until release.
- **Developer name.** "Illuminate Drones, LLC", set when the app record was created on 2026-11-03. Apple
  lets an organization set this only once, with its first app, and it cannot be edited later. It would
  have to be a registered trade name or DBA to differ from the legal name, and it applies to every app in
  the account. Showing a different name later means transferring the app to another developer account.
- **Price.** Free (no bank or tax forms needed).
- **Icon.** A glowing dumbbell whose plates step down like stairs, inside a ten-segment counter ring (the same ten steps
  as the app's medal bar). Drawn by `scripts/icon/icon.py`, installed by `scripts/make-icon.sh`. The store icon comes
  from the uploaded build, so changing it means uploading a new build.

## Listing text

| Field | Text |
|---|---|
| Subtitle (30) | Workout log, streaks & goals |
| Category | Health & Fitness |
| Age rating | 4+ (answer "None" to every content question) |
| Promotional text (170) | Log every set, watch your progress charts, and hit your daily step goal. A Home Screen widget keeps your streak in sight. |
| Keywords (100) | gym,lifting,tracker,strength,reps,progress,widget,exercise,weights,routine,habit,pedometer,1rm |
| Support URL | https://layorjunia-workouts.vercel.app/support.html |
| Privacy policy URL | https://layorjunia-workouts.vercel.app/privacy.html |
| Copyright | 2026 Illuminate Drones, LLC |

**Description**

Sets & Steps is a fast, no-nonsense log for lifting and daily activity.

- Log workouts from templates you can edit: sets, reps, weight, time and cardio.
- See your progress: estimated 1RM, volume, personal records and a chart for every exercise.
- Steps and streaks: reads your steps from Apple Health, tracks a daily goal and a streak, and shows both in a Home Screen widget.
- Goals with medals: set a rep or step total and earn a medal at every 10%, with daily rings showing what today needs.
- Body and nutrition: weight trends, plus protein, carbs and fat from Health.
- Your log is saved on your phone first, so spotty gym Wi-Fi never loses a set. Sign in (optional) to sync across devices with a name and a 4-digit PIN, and delete your account in Settings any time.
- Private: no ads and no tracking.

Sets & Steps is a general fitness log, not medical advice.

## Notes for App Review

> Sets & Steps is a native iPhone app with Apple Health (HealthKit) integration, a Home Screen
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

Six iPhone 6.9-inch images (1320 x 2868) are in `store/screenshots/iphone-6.9/` (git-ignored): Today,
Progress, Steps, Goals analytics (figures, daily chart, activity grid), Goals, Health. They are the real app rendered from made-up demo data, with an iPhone
status bar drawn on. Regenerate them after any UI change with `node scripts/screenshots.mjs` (needs
Google Chrome), then swap them in the listing with `python3 scripts/asc-listing.py screenshots --replace`.
No iPad set is needed (the app is iPhone-only).

## Checklist

| # | Step | Who | State |
|---|---|---|---|
| 1 | Accept Apple's updated Program License Agreement | Jacob | done |
| 2 | Decide the names and create the app in App Store Connect | done | created 2026-11-03: "Sets & Steps" by Illuminate Drones, LLC |
| 3 | In-app account deletion (App Review 5.1.1(v)) | done | live in v68 |
| 4 | First-launch fix, and no personal goals for new people | done | live in v68 |
| 5 | Privacy policy and support pages, in-app links | done | live |
| 6 | iPhone-only, privacy manifests, encryption flag, clearer Health wording | done | in the signed export |
| 7 | Deploy the web changes | done | pushed as 561c8fb, checked live |
| 8 | Screenshots | done | 6 uploaded (1320 x 2868) to the 6.7/6.9-inch slot, `store/screenshots/iphone-6.9/`; retaken for the new Steps and Goals look (v72) |
| 9 | App Store signing profiles, and a signed export of the .ipa | done | tested, then used for the upload |
| 10 | Upload the build and fill in the listing (text, category, age rating 4+, free, 175 storefronts, copyright, content rights, review notes) | done | build 261103.1303 (new icon) attached to 1.0; `scripts/release.sh --upload`, `scripts/asc-listing.py` |
| 11 | In App Store Connect (web only): App Privacy answers, regulated-medical-device declaration (App Information), EU Digital Services Act trader status, and the review contact phone (Apple requires one) | Jacob | waiting |
| 12 | Add for Review, then Submit (releases automatically once approved) | Jacob's go-ahead | |

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
