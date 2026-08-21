// Native HealthKit sync — only active inside the Capacitor iOS shell. In a
// browser this file loads but every code path is a no-op, so one web build
// serves Vercel, GitHub Pages, and the native app.
//
// Data flow (native only):
//   1. First sync after sign-in triggers the iOS HealthKit permission sheet.
//   2. Read the metrics the app cares about via @capgo/capacitor-health.
//   3. Hand them to app.js (window.__applyNativeHealth), which merges them
//      into state.health.data and calls saveState() — the existing Firestore
//      push then carries them to every other device. No separate endpoint,
//      no credentials cached on the phone.
//   4. Repeat on app foreground and every 30 min while the app is open.

(function () {
  const isNative = () => !!(window.Capacitor?.isNativePlatform?.());
  if (!isNative()) return;

  const READ_TYPES = [
    "restingHeartRate", "heartRateVariability", "oxygenSaturation",
    "sleep", "steps", "calories", "weight", "bodyFat",
  ];
  const AUTH_KEY = "workout-tracker:healthKitAuthed";
  const SYNC_INTERVAL_MS = 30 * 60 * 1000;
  let syncTimer = null;
  let syncing = false;

  const health = () => window.Capacitor?.Plugins?.Health || null;

  async function ensureAuthorized() {
    const h = health();
    if (!h) throw new Error("Health plugin not available");
    if (localStorage.getItem(AUTH_KEY) === "1") return;
    // Shows the iOS permission sheet the first time; no-op afterwards.
    await h.requestAuthorization({ read: READ_TYPES, write: [] });
    localStorage.setItem(AUTH_KEY, "1");
  }

  const iso = (ms) => new Date(ms).toISOString();
  const now = () => Date.now();
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); };

  async function read(dataType, startDate, limit) {
    const h = health();
    try {
      const { samples } = await h.readSamples({ dataType, startDate, endDate: iso(now()), limit });
      return samples || [];
    } catch (e) {
      console.warn(`[health] read ${dataType} failed:`, e?.message || e);
      return [];
    }
  }

  async function latest(dataType, sinceMs) {
    const samples = await read(dataType, iso(now() - sinceMs), 50);
    if (!samples.length) return null;
    samples.sort((a, b) => (b.endDate || b.startDate).localeCompare(a.endDate || a.startDate));
    return samples[0].value;
  }

  async function sumToday(dataType) {
    const samples = await read(dataType, startOfToday(), 10000);
    if (!samples.length) return null;
    return samples.reduce((acc, s) => acc + (Number(s.value) || 0), 0);
  }

  // Sum asleep-phase durations over the last 24h. Excludes inBed/awake.
  async function sleepHoursLastNight() {
    const samples = await read("sleep", iso(now() - 24 * 3600 * 1000), 10000);
    if (!samples.length) return null;
    const ASLEEP = new Set(["asleep", "light", "deep", "rem"]);
    let mins = 0;
    for (const s of samples) {
      if (s.sleepState && !ASLEEP.has(s.sleepState)) continue;
      const a = Date.parse(s.startDate), b = Date.parse(s.endDate);
      if (Number.isFinite(a) && Number.isFinite(b) && b > a) mins += (b - a) / 60000;
    }
    return mins > 0 ? mins / 60 : null;
  }

  const DAY = 24 * 3600 * 1000;

  async function collectMetrics() {
    const [restingHR, hrv, spo2, steps, kcal, kg, fat, sleep] = await Promise.all([
      latest("restingHeartRate", 2 * DAY),
      latest("heartRateVariability", 2 * DAY),
      latest("oxygenSaturation", 2 * DAY),
      sumToday("steps"),
      sumToday("calories"),
      latest("weight", 60 * DAY),
      latest("bodyFat", 60 * DAY),
      sleepHoursLastNight(),
    ]);
    const r1 = (n) => Math.round(n * 10) / 10;
    const out = {};
    if (restingHR != null) out.restingHR         = Math.round(restingHR);
    if (hrv       != null) out.hrv               = Math.round(hrv);
    if (spo2      != null) out.bloodOxygen       = Math.round(spo2 * 100);      // HK percent = 0..1
    if (steps     != null) out.stepsToday        = Math.round(steps);
    if (kcal      != null) out.activeEnergyToday = Math.round(kcal);
    if (kg        != null) out.weightLbs         = r1(kg * 2.2046226218);       // kg → lb
    if (fat       != null) out.bodyFatPct        = r1(fat * 100);               // fraction → %
    if (sleep     != null) out.sleepHours        = r1(sleep);
    return out;
  }

  async function syncNow() {
    if (syncing) return;
    syncing = true;
    try {
      await ensureAuthorized();
      const metrics = await collectMetrics();
      if (Object.keys(metrics).length === 0) {
        console.log("[health] no samples returned (permissions denied, or no Watch data yet)");
        return;
      }
      window.__applyNativeHealth?.(metrics);
      console.log("[health] applied", Object.keys(metrics).join(", "));
    } finally {
      syncing = false;
    }
  }

  function start() {
    syncNow().catch((e) => console.warn("[health] sync failed:", e?.message || e));
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = setInterval(() => syncNow().catch(() => {}), SYNC_INTERVAL_MS);
  }
  function stop() {
    if (syncTimer) { clearInterval(syncTimer); syncTimer = null; }
  }

  window.WorkoutNativeHealth = { isNative: true, syncNow, start, stop };

  // Re-sync when the app returns to the foreground (after permission granted once).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && localStorage.getItem(AUTH_KEY) === "1") syncNow().catch(() => {});
  });

  // Relaunch: if Health was already authorized, resume the periodic sync.
  if (localStorage.getItem(AUTH_KEY) === "1") start();
})();
