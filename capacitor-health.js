// Native HealthKit sync — only runs when the app is running inside the
// Capacitor iOS shell. In the browser (Vercel / GitHub Pages) this file is
// still loaded but everything is a no-op, so the same web build works
// everywhere.
//
// Data flow:
//   1. On first launch after the user signs in, request HealthKit permissions.
//   2. Read the 8 metrics the app cares about via @capgo/capacitor-health.
//   3. POST them to /api/health with the user's name + PIN so they land in
//      the same Firestore doc the browser reads.
//   4. Repeat on app foreground and on a rough 30-min timer while open.

(function () {
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  if (!isNative()) return; // browser build — nothing to do

  const READ_TYPES = [
    "restingHeartRate", "heartRateVariability", "oxygenSaturation",
    "sleep", "steps", "calories", "weight", "bodyFat",
  ];

  const API_URL = "https://layorjunia-workouts.vercel.app/api/health";
  const CRED_KEY = "workout-tracker:healthSyncCreds";
  const AUTH_KEY = "workout-tracker:healthKitAuthed";
  let syncTimer = null;

  function health() {
    return window.Capacitor?.Plugins?.Health || null;
  }

  async function requestPermissionsOnce() {
    const h = health();
    if (!h) return false;
    if (localStorage.getItem(AUTH_KEY) === "1") return true;
    try {
      await h.requestAuthorization({ read: READ_TYPES, write: [] });
      localStorage.setItem(AUTH_KEY, "1");
      return true;
    } catch (e) {
      console.warn("HealthKit auth failed:", e);
      return false;
    }
  }

  function startOfToday() {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  function twentyFourHoursAgo() {
    return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  }

  async function latestValue(dataType, startIso) {
    const h = health();
    if (!h) return null;
    try {
      const { samples } = await h.readSamples({
        dataType,
        startDate: startIso,
        endDate: new Date().toISOString(),
        limit: 1,
      });
      if (!samples || samples.length === 0) return null;
      // Return the most recent sample's value
      const sorted = samples.slice().sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate));
      return sorted[0].value;
    } catch (e) {
      console.warn(`readSamples(${dataType}) failed:`, e);
      return null;
    }
  }

  async function sumSince(dataType, startIso) {
    const h = health();
    if (!h) return null;
    try {
      const { samples } = await h.readSamples({
        dataType,
        startDate: startIso,
        endDate: new Date().toISOString(),
        limit: 10000,
      });
      if (!samples || samples.length === 0) return null;
      return samples.reduce((acc, s) => acc + (s.value || 0), 0);
    } catch (e) {
      console.warn(`sumSince(${dataType}) failed:`, e);
      return null;
    }
  }

  async function totalSleepHours(startIso) {
    const h = health();
    if (!h) return null;
    try {
      const { samples } = await h.readSamples({
        dataType: "sleep",
        startDate: startIso,
        endDate: new Date().toISOString(),
        limit: 10000,
      });
      if (!samples || samples.length === 0) return null;
      // Sum "asleep" durations. Fall back to total range if no state info.
      let mins = 0;
      for (const s of samples) {
        if (s.sleepState && s.sleepState !== "asleep" && s.sleepState !== "rem" && s.sleepState !== "deep" && s.sleepState !== "light") continue;
        const start = new Date(s.startDate).getTime();
        const end = new Date(s.endDate).getTime();
        if (Number.isFinite(start) && Number.isFinite(end)) mins += Math.max(0, (end - start) / 60000);
      }
      return mins / 60;
    } catch (e) {
      console.warn("sleep read failed:", e);
      return null;
    }
  }

  async function collectMetrics() {
    const dayStart = startOfToday();
    const yesterday = twentyFourHoursAgo();
    const [
      restingHR, hrv, bloodOxygen,
      stepsToday, activeEnergyToday, weight, bodyFatPct,
      sleepHours,
    ] = await Promise.all([
      latestValue("restingHeartRate", yesterday),
      latestValue("heartRateVariability", yesterday),
      latestValue("oxygenSaturation", yesterday),
      sumSince("steps", dayStart),
      sumSince("calories", dayStart),
      latestValue("weight", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      latestValue("bodyFat", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      totalSleepHours(yesterday),
    ]);

    const out = {};
    if (restingHR       != null) out.restingHR        = Math.round(restingHR);
    if (hrv             != null) out.hrv              = Math.round(hrv);
    if (bloodOxygen     != null) out.bloodOxygen      = Math.round(bloodOxygen * 100); // Health returns 0..1
    if (stepsToday      != null) out.stepsToday       = Math.round(stepsToday);
    if (activeEnergyToday != null) out.activeEnergyToday = Math.round(activeEnergyToday);
    if (weight          != null) out.weightLbs        = Math.round(weight * 2.2046226218 * 10) / 10; // kg → lb
    if (bodyFatPct      != null) out.bodyFatPct       = Math.round(bodyFatPct * 100 * 10) / 10;    // fraction → %
    if (sleepHours      != null) out.sleepHours       = Math.round(sleepHours * 10) / 10;
    return out;
  }

  async function pushToApi(metrics) {
    const raw = localStorage.getItem(CRED_KEY);
    if (!raw) return { skipped: "no_creds" };
    const { name, pin } = JSON.parse(raw);
    if (!name || !pin) return { skipped: "no_creds" };
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, pin, ...metrics }),
    });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  }

  async function runSync() {
    const ok = await requestPermissionsOnce();
    if (!ok) return;
    const metrics = await collectMetrics();
    if (Object.keys(metrics).length === 0) return;
    const result = await pushToApi(metrics);
    console.log("[health] pushed", Object.keys(metrics), "→", result);
  }

  // Called from app.js after successful sign-in, so we know we have creds.
  window.WorkoutNativeHealth = {
    // Cache credentials so the timer / foreground events can re-sync silently.
    // Called from app.js right after a successful sign-in.
    setCredentials(name, pin) {
      localStorage.setItem(CRED_KEY, JSON.stringify({ name, pin }));
      runSync().catch(e => console.warn("health sync error:", e));
      if (syncTimer) clearInterval(syncTimer);
      syncTimer = setInterval(() => runSync().catch(() => {}), 30 * 60 * 1000);
    },
    clearCredentials() {
      localStorage.removeItem(CRED_KEY);
      localStorage.removeItem(AUTH_KEY);
      if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
    },
    async syncNow() { await runSync(); },
    isNative: true,
  };

  // Re-sync when the app comes back to the foreground.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && localStorage.getItem(CRED_KEY)) runSync().catch(() => {});
  });

  // If creds are already stored (rehydration after app relaunch), kick off a sync.
  if (localStorage.getItem(CRED_KEY)) {
    runSync().catch(() => {});
    syncTimer = setInterval(() => runSync().catch(() => {}), 30 * 60 * 1000);
  }
})();
