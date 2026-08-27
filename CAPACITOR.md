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
</dict>
</plist>
```

> **Do not add `com.apple.developer.healthkit.access`.** Even as an empty
> array, Xcode treats it as the *Clinical / Verifiable Health Records*
> sub-capability, which Apple has to approve per team. Automatic signing
> then fails with "Provisioning profile doesn't include the HealthKit
> Access (Verifiable Health Records) capability". Plain HealthKit reads
> only need the single boolean above.

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

**Where to send the data:** if your web app already syncs its state to a
backend (this one pushes to Firestore on every save), write the HealthKit
values into that same local state and let the existing sync carry them.
Don't bolt on a separate upload endpoint for native — it means caching
credentials on the device and creates a race between the two writers. The
native layer's only job is *read HealthKit → hand JS a plain object*.

Unit gotchas from `@capgo/capacitor-health` on iOS: `percent` types
(`oxygenSaturation`, `bodyFat`) come back as **0–1 fractions**, `weight` is
**kilograms**, `calories` is `activeEnergyBurned` in kcal, and `sleep` is a
category type — sum the `startDate→endDate` spans whose `sleepState` is one
of `asleep | light | deep | rem` and skip `inBed | awake`.

---

## 5b. When the npm plugin doesn't cover a HealthKit type — write a tiny one in-app

`@capgo/capacitor-health` had no dietary protein/carbs/fat, so the nutrition
reader is ~90 lines of Swift living in the app target, no npm package needed.
Pattern:

1. **`ios/App/App/NutritionPlugin.swift`** — subclass `CAPPlugin`, adopt
   `CAPBridgedPlugin`, declare `identifier`, `jsName`, and a `pluginMethods`
   list. Each `@objc func name(_ call: CAPPluginCall)` resolves with a
   dictionary. (`HKStatisticsCollectionQuery` with a 1-day interval gives
   per-day sums in one query.)
2. **`ios/App/App/MainViewController.swift`** — subclass
   `CAPBridgeViewController` and register the instance:
   ```swift
   override open func capacitorDidLoad() { bridge?.registerPluginInstance(NutritionPlugin()) }
   ```
3. **`Main.storyboard`** — point the view controller at it:
   `customClass="MainViewController" customModule="App" customModuleProvider="target"`.
4. **Add both files to the Xcode project.** Either drag them into the App group
   in Xcode, or script the `project.pbxproj` edit (a `PBXFileReference`, a
   `PBXBuildFile`, an entry in the App group's `children`, and one in the
   Sources build phase `files`).
5. Call it from JS as `window.Capacitor.Plugins.<jsName>.<method>(args)`.

Same `NSHealthShareUsageDescription` + `com.apple.developer.healthkit`
entitlement cover the new types; the permission sheet just lists more rows.

## 5a′. Firebase Auth hangs forever in the native shell — fix

Symptom: `signInWithEmailAndPassword` (or any auth call) never resolves inside
the Capacitor app while the identical code works in Safari/Chrome. Cause:
`getAuth()` installs `browserPopupRedirectResolver`, and on an iPhone
user-agent Firebase *proactively* loads the auth iframe from `authDomain` and
awaits a postMessage handshake. Under `capacitor://localhost` that handshake
never completes, and every auth call queues behind it.

```js
// instead of getAuth(app):
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
});
// popup flows (web only) pass the resolver explicitly:
signInWithPopup(auth, provider, browserPopupRedirectResolver);
```

Reproduce/verify in the iOS Simulator — it has the same WKWebView + custom
scheme as the device and needs no HealthKit.

## 5c. Offline-first checklist (what "works in a gym with no signal" needs)

- **No CDN scripts.** Bundle the SDKs (`esbuild file.js --bundle --format=esm`)
  and vendor UMD libraries into the repo; the native shell only ships what's in
  `www/`. A CDN `<script>` that fails offline can silently disable sync.
- **Firestore persistent cache** (`initializeFirestore(app, { localCache:
  persistentLocalCache(...) })`) so writes made offline queue across relaunches.
- **Persisted auth** (`browserLocalPersistence`) so an offline launch is still
  signed in.
- **Merge, don't replace.** Keep per-record `updatedAt`, tombstones for deletes,
  and a deterministic merge; push only when the merge changed something, or two
  devices will ping-pong forever.
- **Flush on background**: iOS suspends JS timers, so a 2-second debounce can
  be lost — force the pending push on `visibilitychange`/`pagehide`.
- Set `ignoreUndefinedProperties: true` (or never emit `undefined`) — Firestore
  rejects documents containing it.

## 6. Sync and open in Xcode

```bash
npm run cap:sync   # copies www/ → ios/App/App/public/ and refreshes plugins
open ios/App/App.xcodeproj
```

Capacitor 8 resolves plugins through **Swift Package Manager**, so there is
no `.xcworkspace` — the `.xcodeproj` is the thing to open. (Only
CocoaPods-era projects, Capacitor ≤ 5 or plugins without a `Package.swift`,
generate a workspace; if you see one, open that instead.)

---

## 7. Sign & install on your phone

**The first signed build must happen inside Xcode.app.** Automatic signing
needs your Apple ID to register the App ID, attach the HealthKit capability,
and mint the device profile. On Xcode 26 that login lives in a store the
command line can't read — `xcodebuild` from a terminal reports
`No Accounts: Add a new account in Accounts settings` **even when Xcode is
signed in**, and `defaults read com.apple.dt.Xcode …AppleIDLists` /
`security find-generic-password -l Xcode-Token` both come back empty. Don't
let those fool you into re-adding the account.

Do the first build from the GUI (⌘B with the iPhone selected as the run
destination), or drive Xcode with AppleScript so it's scriptable:

```bash
osascript <<'EOF'
with timeout of 1500 seconds
  tell application "Xcode"
    open POSIX file "/path/to/ios/App/App.xcodeproj"
    delay 4
    set ws to first workspace document whose path contains "ios/App"
    repeat until loaded of ws
      delay 1
    end repeat
    set active scheme of ws to (first scheme of ws whose name is "App")
    set active run destination of ws to (first run destination of ws whose name is "<Your iPhone name>")
    set r to build ws
    repeat until completed of r
      delay 2
    end repeat
    return status of r as text
  end tell
end timeout
EOF
```

(Variable names matter: `rd`, `d` and a few other short names collide with
Xcode's dictionary and give "Expected variable name or property".)

That one build writes `iOS Team Provisioning Profile: <bundle id>` to
`~/Library/Developer/Xcode/UserData/Provisioning Profiles/`. From then on
plain `xcodebuild` signs against the on-disk profile without touching the
account, so the headless loop below works for every subsequent deploy:

```bash
# Bake the team into the project once (both Debug and Release blocks):
#   DEVELOPMENT_TEAM = <TEAMID>;   next to CODE_SIGN_STYLE = Automatic;

# Find your phone's destination id
xcodebuild -project ios/App/App.xcodeproj -scheme App -showdestinations | grep "platform:iOS,"

# Build Release, signing against the profile Xcode already minted
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'id=<DEVICE_ID>' -derivedDataPath build build

# devicectl wants the CoreDevice UUID (different from the xcodebuild id above)
xcrun devicectl list devices
xcrun devicectl device install app --device <COREDEVICE_UUID> build/Build/Products/Release-iphoneos/App.app
xcrun devicectl device process launch --device <COREDEVICE_UUID> com.<you>.<appname>
```

In this repo those are wrapped as `npm run ios:deploy` (build + install +
launch) — edit the two device IDs in `package.json` for a different phone.

Plug your iPhone in via USB the first time — after that Xcode remembers it
wirelessly on the same network.

**Sanity-check the artifact before installing** — this catches a missing
capability or an unregistered device without a round-trip to the phone:

```bash
codesign -d --entitlements :- build/Build/Products/Release-iphoneos/App.app | grep healthkit
security cms -D -i build/Build/Products/Release-iphoneos/App.app/embedded.mobileprovision \
  | plutil -extract ProvisionedDevices json -o - -
```

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


---

## 11. Remote mode: ship web changes without reinstalling

Bundled mode (the default above) freezes the web assets into the .app — every
JS/CSS tweak needs a rebuild + reinstall. Once the native surface stabilizes
(plugins, widgets, entitlements), flip the shell to load the LIVE site:

```json
// capacitor.config.json
{
  "server": { "url": "https://your-app.vercel.app" },
  "ios": { "limitsNavigationsToAppBoundDomains": true }
}
```

```xml
<!-- Info.plist — Apple requires app-bound domains for Service Workers in WKWebView -->
<key>WKAppBoundDomains</key>
<array><string>your-app.vercel.app</string></array>
```

Register your service worker on the https origin (skip only `capacitor:`):
the SW is what keeps cold-start working offline now that assets aren't bundled.
Capacitor still injects the bridge into the remote page, so native plugins
keep working exactly as before.

After one final rebuild+install, `git push` IS the deploy: the phone picks up
web changes on next launch (SW updates in the background — second launch after
a deploy runs the new version).

**Trade-offs, honestly:**
- The very first launch (and any launch after iOS evicts the SW cache, which
  is rare in an app container) needs network. Bundled mode never does.
- Switching modes changes the WebView origin → localStorage/IndexedDB start
  empty → users re-sign-in once; cloud state restores everything.
- Native changes (new plugin, widget, entitlements, Info.plist) still need a
  rebuild — that's the 1% case.
- Keep versioned asset URLs + a versioned SW cache so updates are atomic.
