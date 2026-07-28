# Wrapping any web app in Capacitor for native iOS (with HealthKit access)

The workout tracker uses this pattern to gain HealthKit access without
rewriting a single line of the web code. This guide extracts what I did into
a reusable checklist for any web app (personal or client work).

**What you get:** the same web code you already ship runs inside a native
`.app` bundle. Now it can call into HealthKit (or any other iOS-only API you
add a plugin for) exactly like Strava or MyFitnessPal.

**What it costs:**
- 30 minutes of setup per project (this guide)
- $99/yr Apple Developer account for real device installs (or free 7-day
  sideloads if you can rebuild every week)
- Node.js + Xcode on the Mac you use for builds

---

## 1. Prerequisites (one-time on your Mac)

```bash
# Node ≥ 18
node --version

# Xcode with iOS platform files installed
# Open Xcode → Settings → Components → download the "iOS <current>" platform
xcodebuild -showsdks | grep iOS

# CocoaPods — Capacitor CLI needs it for legacy plugin support
brew install cocoapods
```

Log into your Apple ID in **Xcode → Settings → Accounts** and download the
signing credentials (Manage Certificates → +). You'll pick a signing team
later per project.

---

## 2. Add Capacitor to your existing web app

From the root of your web project (the folder with `index.html`, `app.js`,
etc.):

```bash
# Create a minimal package.json if the project doesn't have one
npm init -y

# Install Capacitor (match major versions across all three)
npm install @capacitor/core @capacitor/ios
npm install --save-dev @capacitor/cli

# For HealthKit specifically:
npm install @capgo/capacitor-health
```

Version the plugin to Capacitor's major (e.g. Capacitor 8 → plugin 8.x).
Check `npm view @capgo/capacitor-health peerDependencies` before installing.

Add a `capacitor.config.json` at the repo root:

```json
{
  "appId": "com.<you>.<appname>",
  "appName": "Your App Name",
  "webDir": "www",
  "ios": {
    "contentInset": "always",
    "backgroundColor": "#0b0d10"
  },
  "server": { "iosScheme": "capacitor" }
}
```

- `appId` becomes the iOS bundle identifier — reverse-DNS, must be unique in
  your dev account.
- `webDir` is where Capacitor copies web assets from into the native project.

Add a `build:web` script to `package.json` so you control exactly which files
ship (Capacitor grabs the *contents* of `webDir` recursively):

```json
"scripts": {
  "build:web": "rm -rf www && mkdir -p www && cp index.html app.js styles.css www/",
  "cap:sync":  "npm run build:web && npx cap sync ios",
  "cap:open":  "npm run cap:sync && npx cap open ios"
}
```

Add every file the web app needs — don't `cp -r` the whole repo or you'll
copy `node_modules` and `ios/` into the bundle.

---

## 3. Generate the iOS project

```bash
npm run build:web
npx cap add ios
```

This creates an `ios/` directory with an Xcode workspace and drops the
plugin's Swift Package into it automatically. You never touch that directory
directly — regenerate it with `npx cap sync ios` after any change.

---

## 4. Wire up HealthKit (the iOS-only part)

Two files need edits inside the generated `ios/App/App/` directory. Keep the
edits in git so `cap sync` doesn't lose them (it only writes to `public/`).

**`ios/App/App/Info.plist`** — Apple requires a user-facing string for every
Health data category you touch. Add before the closing `</dict>`:

```xml
<key>NSHealthShareUsageDescription</key>
<string>This app reads heart rate, sleep, activity, and body composition so you can see them alongside your workouts.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>This app does not write to Health.</string>
```

Change the strings to match your product — Apple reads them literally when
they review builds.

**`ios/App/App/App.entitlements`** (create it if it doesn't exist):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.healthkit</key>
  <true/>
  <key>com.apple.developer.healthkit.access</key>
  <array/>
</dict>
</plist>
```

Point the Xcode project at that entitlements file. Edit
`ios/App/App.xcodeproj/project.pbxproj` and add this line inside **both** the
Debug and Release build settings blocks (search for `CODE_SIGN_STYLE`):

```
CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
```

The alternative to the manual pbxproj edit: open the project in Xcode → App
target → Signing & Capabilities → **+ Capability → HealthKit**. Xcode will
create the entitlements file for you.

---

## 5. Call HealthKit from JavaScript

Capacitor auto-registers native plugins onto `window.Capacitor.Plugins.<jsName>`
once the app boots inside the native shell. For `@capgo/capacitor-health` the
`jsName` is `Health`. **You do not need a bundler** — regular `<script>`
tags work.

Add a script that runs only on the native platform:

```js
// health-native.js
(function () {
  if (!window.Capacitor?.isNativePlatform?.()) return; // browser build — noop

  async function syncOnce() {
    const health = window.Capacitor.Plugins.Health;
    await health.requestAuthorization({
      read: ['restingHeartRate', 'heartRateVariability', 'sleep',
             'steps', 'calories', 'weight', 'bodyFat'],
      write: [],
    });
    const { samples } = await health.readSamples({
      dataType: 'restingHeartRate',
      startDate: new Date(Date.now() - 24*3600*1000).toISOString(),
      endDate:   new Date().toISOString(),
      limit: 1,
    });
    console.log('resting HR sample:', samples[0]);
  }

  document.addEventListener('DOMContentLoaded', syncOnce);
})();
```

Include it in `index.html`:

```html
<script src="health-native.js"></script>
```

Same file works on the web — the `isNativePlatform` guard early-returns.

---

## 6. Sync and open in Xcode

```bash
npm run cap:sync   # copies www/ → ios/App/App/public/ and refreshes plugins
open ios/App/App.xcworkspace
```

**Never open `App.xcodeproj` directly** — Capacitor uses the workspace so
Swift Package Manager plugins get pulled in.

---

## 7. Sign & install on your phone

In Xcode, select the **App** target → **Signing & Capabilities**:

1. **Team** — pick your Apple Developer team from the dropdown
2. Verify **Automatically manage signing** is ticked
3. If Xcode complains "no matching provisioning profile", click **Try Again**
   — it'll create the profile for you against the bundle ID from
   `capacitor.config.json`.

Confirm the **HealthKit** capability is listed. If not: **+ Capability → HealthKit**.

Plug your iPhone in via USB (first time only — after that Xcode will remember
it wirelessly if it's on the same network). Select it as the run destination
in the top bar, then hit **⌘R**.

First launch on-device:
- iOS shows the "Trust This Developer" prompt if it's the first personal-team
  app on that phone (**Settings → General → VPN & Device Management → your
  team → Trust**)
- Your app then shows the native "grant Health access" screen exactly like
  Strava. Tap **Turn On All** (or a subset) → done.

Now the JS in step 5 reads real Watch data via `window.Capacitor.Plugins.Health`.

---

## 8. Iterating on web code

Edit your web files as normal. To ship changes to the phone:

```bash
npm run cap:sync   # regenerates www + copies into ios/App/App/public
```

Then in Xcode: **⌘R** to reinstall. Native code changes need a rebuild;
pure-web changes only need the `cap:sync` + reinstall.

---

## 9. Things that will bite you

- **Bundle ID collision.** Every Capacitor app you deploy needs a globally
  unique `appId`. Pick something like `com.<yourhandle>.<slug>`.
- **Version drift.** All three of `@capacitor/core`, `@capacitor/ios`, and
  `@capacitor/cli` must be on the same major version. Plugin peer deps must
  match too.
- **HealthKit permission is per data type.** If you add a new metric later,
  the request panel only shows metrics the user hasn't seen before; existing
  denies stick until they open Health → Sources → your app.
- **Simulator has no HealthKit.** You have to test on a physical device.
- **Free provisioning expires every 7 days.** With a paid dev account,
  profiles last a year. Without one, plan to reinstall weekly.
- **`Info.plist` and `App.entitlements` edits get preserved** across
  `cap sync` — but the pbxproj edit is fragile if you ever regenerate the
  iOS project from scratch. Prefer doing capability edits in the Xcode UI
  once things stabilise.
- **File-based service workers don't run under `capacitor://`.** They still
  work but you can drop them if your app is 100% native; nothing offline
  breaks.
- **First-run permission denial is silent** — the plugin's read calls just
  return empty. Check `checkAuthorization` before assuming your reads
  should have returned data.

---

## 10. What this pattern replaces

Before: an iOS Shortcut with 16+ actions polling HealthKit and POSTing to a
Vercel function, plus a paid third-party bridge if you wanted schedule /
reliability.

After: your existing web app opens on the home screen exactly like any App
Store app, gets HealthKit access at native speed, and needs zero
device-side maintenance — the same OS permission model every other health
app uses.

Total code added to the web app: ~150 lines of JS and 15 lines of Info.plist
XML.
