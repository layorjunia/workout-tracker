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
    "heartRate", "workouts",          // per-workout enrichment
  ];
  // Keyed by the type list so adding a type re-prompts users who authorised before.
  const AUTH_KEY = "workout-tracker:healthKitAuthed:" + READ_TYPES.join(",");
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

  async function read(dataType, startDate, limit, endDate) {
    const h = health();
    try {
      const { samples } = await h.readSamples({ dataType, startDate, endDate: endDate || iso(now()), limit });
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

  // Analyze last night: find the main sleep block (segments joined unless the
  // gap exceeds 2 h), then measure asleep time, awake interruptions inside the
  // block, and the onset time. Feeds the Apple-formula sleep score in app.js
  // (duration 50 · bedtime consistency 30 · interruptions 20).
  async function analyzeSleep() {
    const samples = await read("sleep", iso(now() - 30 * 3600 * 1000), 10000);
    if (!samples.length) return null;
    const ASLEEP = new Set(["asleep", "light", "deep", "rem"]);
    const segs = samples
      .map(s => ({ a: Date.parse(s.startDate), b: Date.parse(s.endDate), st: s.sleepState || "asleep" }))
      .filter(s => Number.isFinite(s.a) && Number.isFinite(s.b) && s.b > s.a && s.st !== "inBed")
      .sort((x, y) => x.a - y.a);
    if (!segs.length) return null;

    // Group into blocks split by >2h gaps, keep the block with the most asleep time
    const blocks = [];
    let cur = [segs[0]];
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].a - cur[cur.length - 1].b > 2 * 3600 * 1000) { blocks.push(cur); cur = []; }
      cur.push(segs[i]);
    }
    blocks.push(cur);
    const asleepMin = blk => blk.reduce((m, s) => m + (ASLEEP.has(s.st) ? (s.b - s.a) / 60000 : 0), 0);
    const night = blocks.reduce((best, b) => asleepMin(b) > asleepMin(best) ? b : best, blocks[0]);

    const mins = asleepMin(night);
    if (mins <= 0) return null;
    const awakeSegs = night.filter(s => s.st === "awake" && (s.b - s.a) >= 60 * 1000);
    const awakeMin = night.reduce((m, s) => m + (s.st === "awake" ? (s.b - s.a) / 60000 : 0), 0);
    const onset = new Date(night[0].a);
    // Minutes since noon, so bedtimes around midnight compare without wrapping
    const onsetMin = ((onset.getHours() * 60 + onset.getMinutes()) + 720) % 1440;
    return { hours: mins / 60, awakeMin: Math.round(awakeMin), wakeups: awakeSegs.length, onsetMin, hasDetail: night.some(s => s.st !== "asleep") };
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
      analyzeSleep(),
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
    if (sleep) {
      out.sleepHours   = r1(sleep.hours);
      out.sleepOnsetMin = sleep.onsetMin;
      out.sleepAwakeMin = sleep.awakeMin;
      out.sleepWakeups  = sleep.wakeups;
      out.sleepHasDetail = !!sleep.hasDetail;
    }
    return out;
  }

  // ── Historical backfill ─────────────────────────────────────────────────
  // Reads day-bucketed history straight from HealthKit and hands app.js a
  // {date: metrics} map. Sleep is grouped into nights (segments joined unless
  // the gap exceeds 2 h) and assigned to the wake-up date; overlapping samples
  // from multiple sources (iPhone + Watch) are interval-unioned so awake and
  // asleep minutes never double-count.
  const localDate = (isoStr) => { const d = new Date(isoStr); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  function unionMinutes(intervals) {
    if (!intervals.length) return 0;
    intervals.sort((x, y) => x[0] - y[0]);
    let total = 0, [cs, ce] = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
      const [a, b] = intervals[i];
      if (a > ce) { total += ce - cs; cs = a; ce = b; }
      else ce = Math.max(ce, b);
    }
    total += ce - cs;
    return total / 60000;
  }

  async function backfillHistory(days = 500, onProgress) {
    await ensureAuthorized();
    const h = health();
    if (!h) return 0;
    const end = new Date();
    const start = new Date(); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
    const startISO = start.toISOString(), endISO = end.toISOString();
    const daily = {};
    const put = (date, k, v) => { if (v == null || Number.isNaN(v)) return; (daily[date] ||= {})[k] = v; };

    const agg = async (dataType, aggregation) => {
      try {
        const { samples } = await h.queryAggregated({ dataType, startDate: startISO, endDate: endISO, bucket: "day", aggregation });
        return samples || [];
      } catch (e) { console.warn("[backfill]", dataType, e?.message || e); return []; }
    };

    onProgress?.("steps & calories");
    for (const s of await agg("steps", "sum")) if (s.value > 0) put(localDate(s.startDate), "stepsToday", Math.round(s.value));
    for (const s of await agg("calories", "sum")) if (s.value > 0) put(localDate(s.startDate), "activeEnergyToday", Math.round(s.value));

    onProgress?.("heart metrics");
    for (const s of await agg("restingHeartRate", "average")) if (s.value > 0) put(localDate(s.startDate), "restingHR", Math.round(s.value));
    for (const s of await agg("heartRateVariability", "average")) if (s.value > 0) put(localDate(s.startDate), "hrv", Math.round(s.value));

    onProgress?.("body weight");
    for (const s of await read("weight", startISO, 10000)) {
      const v = Number(s.value);
      if (v > 0) put(localDate(s.endDate || s.startDate), "weightLbs", Math.round(v * 2.2046226218 * 10) / 10);
    }
    for (const s of await read("bodyFat", startISO, 10000)) {
      const v = Number(s.value);
      if (v > 0) put(localDate(s.endDate || s.startDate), "bodyFatPct", Math.round(v * 1000) / 10);
    }

    onProgress?.("sleep history");
    const ASLEEP = new Set(["asleep", "light", "deep", "rem"]);
    const segs = [];
    for (let t = start.getTime(); t < end.getTime(); t += 90 * 86400000) {
      const chunk = await read("sleep", new Date(t).toISOString(), 10000, new Date(Math.min(t + 90 * 86400000, end.getTime())).toISOString());
      segs.push(...chunk);
    }
    const S = segs
      .map(s => ({ a: Date.parse(s.startDate), b: Date.parse(s.endDate), st: s.sleepState || "asleep" }))
      .filter(s => Number.isFinite(s.a) && Number.isFinite(s.b) && s.b > s.a && s.st !== "inBed")
      .sort((x, y) => x.a - y.a);
    const blocks = [];
    let cur = null;
    for (const s of S) {
      if (!cur || s.a - cur[cur.length - 1].b > 2 * 3600 * 1000) { if (cur) blocks.push(cur); cur = []; }
      cur.push(s);
    }
    if (cur) blocks.push(cur);
    for (const blk of blocks) {
      const asleepMin = unionMinutes(blk.filter(s => ASLEEP.has(s.st)).map(s => [s.a, s.b]));
      if (asleepMin < 120) continue;                     // naps don't count as the night
      const date = localDate(new Date(blk[blk.length - 1].b).toISOString());
      if ((daily[date]?.sleepHours || 0) >= asleepMin / 60) continue;   // keep the longest night per date
      const onset = new Date(blk[0].a);
      const awakeMin = unionMinutes(blk.filter(s => s.st === "awake").map(s => [s.a, s.b]));
      put(date, "sleepHours", Math.round(asleepMin / 6) / 10);
      put(date, "sleepOnsetMin", ((onset.getHours() * 60 + onset.getMinutes()) + 720) % 1440);
      put(date, "sleepAwakeMin", Math.round(awakeMin));
      put(date, "sleepWakeups", blk.filter(s => s.st === "awake" && (s.b - s.a) >= 60000).length);
    }

    window.__applyDailyBackfill?.(daily);
    return Object.keys(daily).length;
  }

  // ── Per-workout enrichment ──────────────────────────────────────────────
  // Given a logged workout's local date + HH:MM start/end, read what the Watch
  // recorded in that window: heart-rate samples (avg/max/min), active calories,
  // and the best-overlapping HealthKit workout session if one exists.
  function localDateTime(dateISO, hhmm) {
    const [y, m, d] = dateISO.split("-").map(Number);
    const [hh, mm] = (hhmm || "00:00").split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  async function enrichWorkout({ date, startTime, endTime }) {
    await ensureAuthorized();
    const h = health();
    if (!h || !date || !startTime || !endTime) return null;
    let start = localDateTime(date, startTime), end = localDateTime(date, endTime);
    if (end <= start) end = new Date(end.getTime() + 24 * 3600 * 1000); // crossed midnight
    const startISO = start.toISOString(), endISO = end.toISOString();

    const [hrSamples, kcalSamples, workoutsRes] = await Promise.all([
      read("heartRate", startISO, 5000, endISO),
      read("calories", startISO, 10000, endISO),
      h.queryWorkouts({
        startDate: new Date(start.getTime() - 15 * 60000).toISOString(),
        endDate: new Date(end.getTime() + 15 * 60000).toISOString(),
        limit: 20,
      }).catch(() => ({ workouts: [] })),
    ]);

    const out = { pulledAt: Date.now(), windowStart: startISO, windowEnd: endISO };
    const hr = hrSamples.map(s => Number(s.value)).filter(v => Number.isFinite(v) && v > 0);
    if (hr.length) {
      out.avgHR = Math.round(hr.reduce((a, b) => a + b, 0) / hr.length);
      out.maxHR = Math.round(Math.max(...hr));
      out.minHR = Math.round(Math.min(...hr));
      out.hrSamples = hr.length;
    }
    const kcal = kcalSamples.reduce((a, s) => a + (Number(s.value) || 0), 0);
    if (kcal > 0) out.activeKcal = Math.round(kcal);

    // Best-overlap Watch workout session, if the user also started one on the wrist
    let best = null, bestOverlap = 0;
    for (const w of (workoutsRes?.workouts || [])) {
      const ws = Date.parse(w.startDate), we = Date.parse(w.endDate);
      const ov = Math.min(we, end.getTime()) - Math.max(ws, start.getTime());
      if (ov > bestOverlap) { bestOverlap = ov; best = w; }
    }
    if (best && bestOverlap > 5 * 60000) {
      const hk = { type: best.workoutType, start: best.startDate, end: best.endDate, durationMin: Math.round((best.duration || 0) / 60) };
      if (best.totalEnergyBurned != null) hk.kcal = Math.round(best.totalEnergyBurned);
      if (best.totalDistance != null) hk.distanceMi = Math.round(best.totalDistance / 1609.344 * 100) / 100;
      if (best.sourceName) hk.source = best.sourceName;
      out.hkWorkout = hk;   // never carries undefined — Firestore rejects it
      // Prefer the Watch session's own calorie total when we have it
      if (out.hkWorkout.kcal) out.activeKcal = out.hkWorkout.kcal;
    }
    const hasAnything = out.avgHR || out.activeKcal || out.hkWorkout;
    return hasAnything ? out : null;
  }

  // ── Nutrition (MyFitnessPal / Cronometer → Apple Health → here) ─────────
  // Backed by the in-app NutritionPlugin (ios/App/App/NutritionPlugin.swift),
  // which sums dietary energy / protein / carbs / fat per day.
  const NUT_AUTH_KEY = "workout-tracker:nutritionAuthed";
  const nutrition = () => window.Capacitor?.Plugins?.Nutrition || null;
  async function syncNutrition(days = 14) {
    const n = nutrition();
    if (!n) throw new Error("Nutrition plugin not available");
    if (localStorage.getItem(NUT_AUTH_KEY) !== "1") {
      await n.requestAuthorization();
      localStorage.setItem(NUT_AUTH_KEY, "1");
    }
    const end = new Date();
    const start = new Date(); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
    const res = await n.dailyTotals({ startDate: start.toISOString(), endDate: end.toISOString() });
    const map = res?.days || {};
    window.__applyNativeNutrition?.(map);
    return Object.keys(map).length;
  }

  async function syncNow() {
    if (syncing) return;
    syncing = true;
    try {
      await ensureAuthorized();
      const metrics = await collectMetrics();
      if (Object.keys(metrics).length === 0) {
        console.log("[health] no samples returned (permissions denied, or no Watch data yet)");
      } else {
        window.__applyNativeHealth?.(metrics);
        console.log("[health] applied", Object.keys(metrics).join(", "));
      }
      // Nutrition rides along once the user has connected it (no prompt otherwise)
      if (localStorage.getItem(NUT_AUTH_KEY) === "1") {
        await syncNutrition(7).catch(e => console.warn("[nutrition] sync failed:", e?.message || e));
      }
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

  window.WorkoutNativeHealth = { isNative: true, syncNow, start, stop, enrichWorkout, syncNutrition, backfillHistory, authorized: () => localStorage.getItem(AUTH_KEY) === "1" };

  // Re-sync when the app returns to the foreground (after permission granted once).
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && localStorage.getItem(AUTH_KEY) === "1") syncNow().catch(() => {});
  });

  // Relaunch: if Health was already authorized, resume the periodic sync.
  if (localStorage.getItem(AUTH_KEY) === "1") start();
})();
