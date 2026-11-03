/* Demo data for App Store screenshots (see scripts/screenshots.mjs). Entirely fictional: a made-up
   person's last eight weeks. Loaded after app.js by the generated demo page. */
window.__errors = [];
window.addEventListener("error", (e) => window.__errors.push(e.message));
window.addEventListener("load", () => setTimeout(() => {
  const view = new URLSearchParams(location.search).get("view") || "today";
  document.documentElement.classList.add("native");   // the iPhone app hides the web-only cards
  document.head.insertAdjacentHTML("beforeend", "<style>.view,.nav-btn,.cheer{transition:none!important;animation:none!important}</style>");
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayISO = (back) => { const d = new Date(today); d.setDate(d.getDate() - back); return isoDateLocal(d); };
  const dow = (back) => { const d = new Date(today); d.setDate(d.getDate() - back); return d.getDay(); };

  const s = defaultState();
  const exId = (name, type = "strength") => {
    let e = s.exercises.find(x => x.name === name);
    if (!e) { e = { id: uid(), name, type, defaultSets: 3, defaultRepRange: "8-12", days: [] }; s.exercises.push(e); }
    return e.id;
  };

  // ───── eight weeks of workouts: Mon push, Wed pull, Fri legs ─────
  const PLAN = {
    1: { day: "Push", lifts: [["Bench Press", 135, 2.5], ["Overhead Military Press", 75, 2.5], ["Dumbbell Side Lateral Raise", 20, 0], ["Tricep Cable Pushdown", 60, 2.5]] },
    3: { day: "Pull", lifts: [["Lat Pulldown", 120, 5], ["Row Machine", 110, 5], ["Preacher Curl", 60, 2.5], ["Cable Face Pull", 40, 2.5]] },
    5: { day: "Legs", lifts: [["Squats", 155, 5], ["Leg Curl Machine", 90, 5], ["Seated Leg Extension", 100, 5], ["Calf Raises", 120, 5]] },
  };
  for (let back = 56; back >= 0; back--) {
    const plan = PLAN[dow(back)];
    if (!plan) continue;
    if (back === 0) continue;                                  // today's session is the live one below
    const week = Math.floor((56 - back) / 7);
    const entries = plan.lifts.map(([name, base, step]) => {
      const load = Math.round((base + step * week) / 2.5) * 2.5;                                  // a steady climb
      const reps = [10, 9, 8].map(r => r - (week < 5 && rnd() < 0.2 ? 1 : 0) + (week >= 6 ? 1 : 0));
      return { exerciseId: exId(name), sets: reps.map(r => ({ load, reps: r })), note: "" };
    });
    const t = Date.parse(dayISO(back) + "T17:30:00");
    s.workouts.push({ id: uid(), date: dayISO(back), day: plan.day, notes: "", entries, createdAt: t, updatedAt: t, startTime: "17:30", endTime: "18:" + String(15 + Math.floor(rnd() * 25)) });
  }

  // ───── today's session, halfway through ─────
  const live = { id: uid(), date: dayISO(0), day: "Push", notes: "", createdAt: Date.now(), updatedAt: Date.now(), entries: [], startTime: "", endTime: "" };
  const lastPush = s.workouts.filter(w => w.day === "Push").slice(-1)[0];
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const st = Math.max(0, nowMin - 38);
  live.startTime = String(Math.floor(st / 60)).padStart(2, "0") + ":" + String(st % 60).padStart(2, "0");
  lastPush.entries.forEach((en, i) => {
    const sets = en.sets.map((x, j) => {
      const done = i < 2 || (i === 2 && j < 2);
      return done ? { load: x.load + (i === 0 ? 2.5 : 0), reps: x.reps + (i === 0 && j === 0 ? 1 : 0) } : blankSet("strength");
    });
    live.entries.push({ exerciseId: en.exerciseId, sets, note: "" });
  });
  s.workouts.push(live);

  // ───── daily health: 40 days of steps, vitals, sleep ─────
  const stepsFor = (back) => back === 0 ? 10432 : back <= 12 ? 10300 + Math.floor(rnd() * 3800) : back === 13 ? 7400 : 7600 + Math.floor(rnd() * 5200);
  for (let back = 40; back >= 0; back--) {
    const date = dayISO(back);
    s.health.daily[date] = {
      stepsToday: stepsFor(back), distanceMiToday: +(stepsFor(back) / 2150).toFixed(1),
      restingHR: 56 + Math.floor(rnd() * 5), hrv: 52 + Math.floor(rnd() * 22), bloodOxygen: 97 + Math.floor(rnd() * 2),
      activeEnergyToday: 520 + Math.floor(rnd() * 260), restingEnergyToday: 1760 + Math.floor(rnd() * 60),
      exerciseMinutesToday: 34 + Math.floor(rnd() * 30), standHoursToday: 10 + Math.floor(rnd() * 3),
      sleepHours: +(6.6 + rnd() * 1.6).toFixed(1), sleepOnsetMin: 600 + Math.floor(rnd() * 70), sleepAwakeMin: 14 + Math.floor(rnd() * 20), sleepWakeups: Math.floor(rnd() * 3),
      weightLbs: +(178.4 - (40 - back) * 0.07 + rnd() * 0.6).toFixed(1), bodyFatPct: +(18.6 - (40 - back) * 0.03).toFixed(1),
      currentHR: 64 + Math.floor(rnd() * 8), updatedAt: Date.now() - back * 86400000,
    };
  }
  s.health.lastFetch = Date.now();
  s.settings.stepLongGoal = { target: 1000000, start: dayISO(33), end: dayISO(-58) };
  s.settings.workoutGoalPerWeek = 3;

  for (let back = 55; back >= 0; back -= 7) s.bodyweight.push({ date: dayISO(back), lbs: +(179.2 - (55 - back) * 0.06).toFixed(1), source: "manual" });
  for (let back = 13; back >= 0; back--) s.nutrition.push({ date: dayISO(back), protein: String(150 + Math.floor(rnd() * 30)), carbs: String(210 + Math.floor(rnd() * 60)), fat: String(58 + Math.floor(rnd() * 16)), notes: "", updatedAt: Date.now() });

  // ───── rep goals with medals ─────
  const start = dayISO(33), end = dayISO(-58);
  const GOALS = [["goal-pushups", "Push-ups", 1000, ["Push-ups"], 16], ["goal-pullups", "Pull-ups", 300, ["Pull Ups"], 5], ["goal-squats", "Squats", 1200, ["Squats", "Bodyweight Squats"], 19]];
  s.goals = GOALS.map(([id, name, target, counts]) => ({ id, name, target, counts, start, end, updatedAt: 1 }));
  GOALS.forEach(([id, , , , perDay]) => {
    for (let back = 32; back >= 0; back--) {
      const n = back === 0 ? Math.round(perDay * 0.7) : Math.round(perDay * (0.75 + rnd() * 0.6));
      if (rnd() < 0.08 && back > 0) continue;
      s.tallies.push({ id: uid(), goalId: id, date: dayISO(back), n, at: Date.now() - back * 86400000, updatedAt: Date.now() });
    }
  });

  state = s;
  activeWorkoutId = live.id;
  saveState();
  applyTheme();

  showView(view);
  setTimeout(() => {
    if (view === "progress") {
      document.querySelector('[data-seg="exercises"]')?.click();
      const sel = $("#progress-exercise"); if (sel) { sel.value = exId("Bench Press"); sel.dispatchEvent(new Event("change")); }
    }
    const q = new URLSearchParams(location.search);
    if (q.get("scrollTo")) { document.querySelector(q.get("scrollTo"))?.scrollIntoView({ block: "start" }); window.scrollBy(0, -(+q.get("pad") || 90)); }
    else if (q.get("scrollY")) window.scrollTo(0, +q.get("scrollY"));
    // iPhone chrome: status bar and home indicator, since a desktop browser has neither
    const chrome = document.createElement("div");
    chrome.innerHTML = `
      <div style="position:fixed;top:0;left:0;right:0;height:62px;z-index:3000;pointer-events:none;color:#fff;font:600 17px -apple-system,system-ui,sans-serif">
        <span style="position:absolute;left:58px;top:19px;letter-spacing:.2px">9:41</span>
        <span style="position:absolute;left:50%;top:11px;width:124px;height:36px;margin-left:-62px;background:#000;border-radius:20px"></span>
        <svg style="position:absolute;right:26px;top:20px" width="80" height="14" viewBox="0 0 80 14" fill="#fff">
          <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="6" width="3" height="6" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
          <path d="M23 4.5a9 9 0 0 1 14 0M25.5 7.5a5.6 5.6 0 0 1 9 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="30" cy="11" r="1.7"/>
          <rect x="45" y="0.5" width="27" height="12.5" rx="3.6" fill="none" stroke="#fff" stroke-opacity=".45"/><rect x="47" y="2.5" width="23" height="8.5" rx="2" /><rect x="74" y="4.5" width="2" height="4.5" rx="1" fill-opacity=".45"/>
        </svg>
      </div>
      <div style="position:fixed;bottom:8px;left:50%;width:140px;height:5px;margin-left:-70px;border-radius:3px;background:#fff;z-index:3000;pointer-events:none"></div>`;
    document.body.appendChild(chrome);
    window.__demoReady = true;
  }, 700);
}, 400));
