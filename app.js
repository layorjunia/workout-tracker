/* Workout Tracker — single-file app. State lives in localStorage. */

const APP_VERSION = "1.0.0";
const STORAGE_KEY = "workout-tracker:v1";

// Pre-seeded exercise library, extracted from the user's spreadsheet history.
const SEED = {
  days: {
    "Day 1": ["Seated Chest Press Machine","Tricep Cable Pushdown","Seated Shoulder Press","Tricep Dips (Assisted)","Pectoral Fly","Ab Twist Machine","Tricep Cable Pushdown Rope","Dumbbell Side Lateral Raise"],
    "Day 2": ["Row Machine","Wide Grip Pull-up (Assisted)","Preacher Curl","Lat Pulldown","Barbell Shrugs","Cable Ab Curl","Cable Face Pull"],
    "Day 3": [],
    "Day 4": ["Chest Press Machine","Wide Grip Pull-up (Assisted)","Neck Flexion","Tricep Dips (Assisted)","Preacher Curl"],
    "Day 5": ["Squats","Barbell Shrugs","Roman Chair","Leg Curl Machine","Hip Abduction","Ab Twist Machine","Seated Leg Extension","Hip Adduction","Squats Leg Press","Ab Oblique Crunch Machine","Calf Raises"],
  },
  exercises: [
    {name:"Ab Oblique Crunch Machine", defaultSets:3, defaultRepRange:"10–12", days:["Day 5"]},
    {name:"Ab Twist Machine", defaultSets:3, defaultRepRange:"12-15", days:["Day 1","Day 5"]},
    {name:"Barbell Shrugs", defaultSets:3, defaultRepRange:"8–10", days:["Day 2","Day 5"]},
    {name:"Cable Ab Curl", defaultSets:3, defaultRepRange:"10–15", days:["Day 2"]},
    {name:"Cable Face Pull", defaultSets:3, defaultRepRange:"10–15", days:["Day 2"]},
    {name:"Calf Raises", defaultSets:3, defaultRepRange:"10–15", days:["Day 5"]},
    {name:"Chest Press Machine", defaultSets:3, defaultRepRange:"8-12", days:["Day 4"]},
    {name:"Dumbbell Side Lateral Raise", defaultSets:3, defaultRepRange:"8–10", days:["Day 1"]},
    {name:"Hip Abduction", defaultSets:3, defaultRepRange:"10–12", days:["Day 5"]},
    {name:"Hip Adduction", defaultSets:3, defaultRepRange:"10–12", days:["Day 5"]},
    {name:"Lat Pulldown", defaultSets:3, defaultRepRange:"8–10", days:["Day 2"]},
    {name:"Leg Curl Machine", defaultSets:3, defaultRepRange:"10–12", days:["Day 5"]},
    {name:"Neck Flexion", defaultSets:3, defaultRepRange:"8-12", days:["Day 4"]},
    {name:"Pectoral Fly", defaultSets:3, defaultRepRange:"8–12", days:["Day 1"]},
    {name:"Preacher Curl", defaultSets:3, defaultRepRange:"8–10", days:["Day 2","Day 4"]},
    {name:"Roman Chair", defaultSets:3, defaultRepRange:"12–15", days:["Day 5"]},
    {name:"Row Machine", defaultSets:3, defaultRepRange:"8–10", days:["Day 2"]},
    {name:"Seated Chest Press Machine", defaultSets:3, defaultRepRange:"10–15", days:["Day 1"]},
    {name:"Seated Leg Extension", defaultSets:3, defaultRepRange:"10–12", days:["Day 5"]},
    {name:"Seated Shoulder Press", defaultSets:3, defaultRepRange:"10–12", days:["Day 1"]},
    {name:"Squats", defaultSets:3, defaultRepRange:"8–10", days:["Day 5"]},
    {name:"Squats Leg Press", defaultSets:3, defaultRepRange:"8–10", days:["Day 5"]},
    {name:"Tricep Cable Pushdown", defaultSets:3, defaultRepRange:"10–12", days:["Day 1"]},
    {name:"Tricep Cable Pushdown Rope", defaultSets:3, defaultRepRange:"10–12", days:["Day 1"]},
    {name:"Tricep Dips (Assisted)", defaultSets:3, defaultRepRange:"8–10", days:["Day 1","Day 4"]},
    {name:"Wide Grip Pull-up (Assisted)", defaultSets:3, defaultRepRange:"10–15", days:["Day 2","Day 4"]},
  ],
};

// Workout templates: when the user taps "New", they pick one of these and the
// session starts with these exercises pre-added. "Blank" creates an empty session.
const TEMPLATES = {
  "Push": {
    subtitle: "Chest · Shoulders · Triceps",
    exercises: [
      "Seated Chest Press Machine",
      "Pectoral Fly",
      "Seated Shoulder Press",
      "Dumbbell Side Lateral Raise",
      "Tricep Cable Pushdown",
    ],
  },
  "Pull": {
    subtitle: "Back · Biceps",
    exercises: [
      "Row Machine",
      "Lat Pulldown",
      "Wide Grip Pull-up (Assisted)",
      "Preacher Curl",
      "Cable Face Pull",
    ],
  },
  "Legs": {
    subtitle: "Quads · Hamstrings · Glutes · Calves",
    exercises: [
      "Squats",
      "Seated Leg Extension",
      "Leg Curl Machine",
      "Hip Abduction",
      "Hip Adduction",
      "Calf Raises",
    ],
  },
  "Mix": {
    subtitle: "Full body · upper + lower",
    exercises: [
      "Chest Press Machine",
      "Lat Pulldown",
      "Squats",
      "Tricep Dips (Assisted)",
      "Ab Twist Machine",
    ],
  },
};

// Historical sessions imported from the original Google Sheets workout plan.
// Auto-loaded on first launch (or when workouts is empty and history hasn't been seeded yet).
const HISTORY = [
  {d:"2025-04-13",day:"Day 1",e:[{n:"Seated Chest Press Machine",s:[[100,11],[100,9],[115,8]]},{n:"Tricep Cable Pushdown",s:[[80,8],[80,8],[80,6]]},{n:"Seated Shoulder Press",s:[[30,8],[65,6],[55,8]]},{n:"Tricep Dips (Assisted)",s:[[50,7],[70,7],[70,8]]},{n:"Pectoral Fly",s:[[100,10],[115,10],[115,12]]}]},
  {d:"2025-04-14",day:"Day 2",e:[{n:"Row Machine",s:[[100,12],[115,10],[115,9]]},{n:"Lat Pulldown",s:[[140,7],[140,8],[140,8]]},{n:"Barbell Shrugs",s:[[90,13],[90,14],[100,12]]},{n:"Cable Ab Curl",s:[[57.5,12],[72.5,10],[80,9]]}]},
  {d:"2025-04-16",day:"Day 4",e:[{n:"Chest Press Machine",s:[[100,13],[115,9],[130,7]]},{n:"Neck Flexion",s:[[25,8],[25,10],[25,10]]},{n:"Tricep Dips (Assisted)",s:[[55,6],[55,5],[55,7]]},{n:"Preacher Curl",s:[[95,12],[95,12],[110,10]]}]},
  {d:"2025-04-17",day:"Day 5",e:[{n:"Squats",s:[[20,8],[40,8],[50,8]]},{n:"Leg Curl Machine",s:[[120,10],[130,11],[130,12]]},{n:"Hip Abduction",s:[[235,11],[235,11],[220,10]]}]},
  {d:"2025-04-20",day:"Day 1",e:[{n:"Seated Chest Press Machine",s:[[115,12],[130,8],[145,6]]},{n:"Tricep Cable Pushdown",s:[[52.5,6],[42.5,12],[47.5,12]]},{n:"Seated Shoulder Press",s:[[65,10],[65,8],[55,7]]},{n:"Tricep Dips (Assisted)",s:[[55,6],[55,6],[55,9]]},{n:"Pectoral Fly",s:[[115,12],[130,8],[165,3]]},{n:"Ab Twist Machine",s:[[130,11],[130,11],[150,10]]}]},
  {d:"2025-04-21",day:"Day 2",e:[{n:"Row Machine",s:[[115,14],[130,12],[145,10]]},{n:"Preacher Curl",s:[[110,10],[110,9],[110,9]]},{n:"Lat Pulldown",s:[[140,9],[180,3],[140,9]]},{n:"Barbell Shrugs",s:[[90,14],[110,12],[110,10]]}]},
  {d:"2025-04-23",day:"Day 4",e:[{n:"Chest Press Machine",s:[[130,10],[130,10],[145,8]]},{n:"Wide Grip Pull-up (Assisted)",s:[[40,8],[40,5],[40,5]]},{n:"Neck Flexion",s:[[25,12],[25,12],[25,12]]},{n:"Tricep Dips (Assisted)",s:[[40,8],[40,9],[40,10]]},{n:"Preacher Curl",s:[[125,12],[125,7],[110,10]]}]},
  {d:"2025-04-24",day:"Day 5",e:[{n:"Squats",s:[[45,10],[65,8],[85,6]]},{n:"Seated Leg Extension",s:[[160,10],[160,10],[145,10]]},{n:"Roman Chair",s:[[25,12],[25,12],[25,12]]},{n:"Leg Curl Machine",s:[[175,9],[160,10],[160,9]]},{n:"Hip Abduction",s:[[235,10],[235,10],[220,12]]},{n:"Hip Adduction",s:[[250,14],[305,18],[305,11]]}]},
  {d:"2025-04-27",day:"Day 1",e:[{n:"Seated Chest Press Machine",s:[[145,10],[145,10],[160,6]]},{n:"Tricep Cable Pushdown Rope",s:[[52.5,12],[42.5,10],[42.5,11]]},{n:"Seated Shoulder Press",s:[[65,9],[65,8],[65,7]]},{n:"Dumbbell Side Lateral Raise",s:[[20,7],[15,10],[15,10]]},{n:"Pectoral Fly",s:[[160,5],[150,6],[145,8]]},{n:"Ab Twist Machine",s:[[130,11],[145,10],[150,10]]}]},
  {d:"2025-04-28",day:"Day 2",e:[{n:"Row Machine",s:[[145,10],[145,10],[160,12]]},{n:"Wide Grip Pull-up (Assisted)",s:[[40,6]]},{n:"Preacher Curl",s:[[125,12],[125,8],[125,7]]},{n:"Barbell Shrugs",s:[[110,15],[110,12],[110,13]]},{n:"Cable Ab Curl",s:[[87.5,10],[80,13],[80,12]]}]},
  {d:"2025-05-01",day:"Day 5",e:[{n:"Squats Leg Press",s:[[170,12],[190,13],[250,9]]},{n:"Barbell Shrugs",s:[[120,10],[120,10],[120,10]]},{n:"Roman Chair",s:[[0,10],[35,10],[35,10]]},{n:"Leg Curl Machine",s:[[160,10],[160,8],[160,10]]},{n:"Hip Abduction",s:[[250,12],[250,12],[250,10]]},{n:"Ab Oblique Crunch Machine",s:[[10,10],[10,10],[10,10]]}]},
];

/* ───────── Helpers ───────── */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
};
const parseNum = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
const fmt = (n, d=0) => {
  if (n === 0 || !Number.isFinite(n)) return "0";
  return n.toLocaleString(undefined, {maximumFractionDigits: d, minimumFractionDigits: 0});
};

// Brzycki estimated 1RM: load * 36 / (37 - reps); guard reps > 36
const oneRM = (load, reps) => {
  if (!load || !reps) return 0;
  if (reps >= 37) return load;
  return load * 36 / (37 - reps);
};
const setVolume = (load, reps) => parseNum(load) * parseNum(reps);

// Body / nutrition math
const ACTIVITY_MULT = {
  sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9
};
function calcBMI(p) {
  if (!p.height || !p.weight) return 0;
  return 703 * p.weight / (p.height * p.height); // imperial
}
function bmiCategory(bmi) {
  if (!bmi) return "";
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}
function calcBMR(p) {
  if (!p.height || !p.weight || !p.age) return 0;
  const wKg = p.weight / 2.2046226218;
  const hCm = p.height * 2.54;
  const base = 10 * wKg + 6.25 * hCm - 5 * p.age;
  return base + (p.sex === "female" ? -161 : 5);
}
function calcTDEE(p) {
  return calcBMR(p) * (ACTIVITY_MULT[p.activity] || 1.55);
}
function macrosToKcal(m) {
  return (parseNum(m.protein)) * 4 + (parseNum(m.carbs)) * 4 + (parseNum(m.fat)) * 9;
}
function getNutritionFor(date) {
  return state.nutrition.find(n => n.date === date) ||
    { date, protein: "", carbs: "", fat: "", notes: "" };
}
function upsertNutrition(date, patch) {
  let n = state.nutrition.find(x => x.date === date);
  if (!n) {
    n = { date, protein: "", carbs: "", fat: "", notes: "" };
    state.nutrition.push(n);
  }
  Object.assign(n, patch);
  saveState();
  return n;
}
function relativeTime(ts) {
  if (!ts) return "Never synced";
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff/60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)} hr ago`;
  return `${Math.floor(diff/86400)} days ago`;
}

// ISO week (Mon-start). Returns {year, week, key:"YYYY-Www", label}
function isoWeek(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const target = new Date(d.valueOf());
  const dayNum = (d.getDay() + 6) % 7; // Mon=0
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target - firstThursday;
  const week = 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  const year = target.getFullYear();
  return {
    year, week,
    key: `${year}-W${String(week).padStart(2,"0")}`,
    label: `W${week} ’${String(year).slice(2)}`,
  };
}
function weekStart(yearWeekKey) {
  const [y, w] = yearWeekKey.split("-W").map(Number);
  const d = new Date(y, 0, 4);
  const dayNum = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dayNum + (w - 1) * 7);
  return d;
}
function prettyDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {weekday:"short", month:"short", day:"numeric"});
}

/* ───────── Storage ───────── */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    }
  } catch (e) {
    console.error("loadState failed", e);
  }
  return defaultState();
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function defaultProfile() {
  return { height: 70, weight: 175, age: 28, sex: "male", activity: "moderate" };
}
function defaultState() {
  const s = {
    schemaVersion: 1,
    exercises: SEED.exercises.map(e => ({ id: uid(), ...e })),
    days: JSON.parse(JSON.stringify(SEED.days)),
    workouts: [],
    settings: { units: "lbs", theme: "dark", gistId: "" },
    profile: defaultProfile(),
    nutrition: [],
    health: { lastFetch: null, data: null, lastError: null },
    seedHistoryLoaded: false,
  };
  loadHistoryInto(s);
  return s;
}
function migrate(s) {
  s.schemaVersion ??= 1;
  s.exercises ??= [];
  s.days ??= JSON.parse(JSON.stringify(SEED.days));
  s.workouts ??= [];
  s.settings ??= { units: "lbs", theme: "dark", gistId: "" };
  s.settings.units ??= "lbs";
  s.settings.theme ??= "dark";
  s.settings.gistId ??= "";
  s.profile = Object.assign(defaultProfile(), s.profile || {});
  s.nutrition ??= [];
  s.health ??= { lastFetch: null, data: null, lastError: null };
  s.seedHistoryLoaded ??= false;

  // Sync any new seed exercises into existing state (idempotent, name-matched)
  SEED.exercises.forEach(seedEx => {
    if (!s.exercises.find(e => e.name.toLowerCase() === seedEx.name.toLowerCase())) {
      s.exercises.push({ id: uid(), ...seedEx });
    }
  });
  // Sync new seed day entries (e.g. Calf Raises added to Day 5)
  Object.keys(SEED.days).forEach(day => {
    s.days[day] = s.days[day] || [];
    SEED.days[day].forEach(name => {
      if (!s.days[day].some(n => n.toLowerCase() === name.toLowerCase())) {
        s.days[day].push(name);
      }
    });
  });

  // Auto-load history once if no workouts have been logged
  if (!s.seedHistoryLoaded && s.workouts.length === 0) loadHistoryInto(s);

  // One-time fix: I originally seeded the imported sheet history with 2026 dates;
  // the spreadsheet's data was actually from 2025. Shift any workout dated to one of
  // the 11 original seed dates back by one year.
  if (!s.historyDatesFixed) {
    const badDates = new Set([
      "2026-04-13","2026-04-14","2026-04-16","2026-04-17",
      "2026-04-20","2026-04-21","2026-04-23","2026-04-24",
      "2026-04-27","2026-04-28","2026-05-01",
    ]);
    s.workouts.forEach(w => {
      if (badDates.has(w.date)) w.date = w.date.replace(/^2026/, "2025");
    });
    s.historyDatesFixed = true;
  }
  return s;
}

// Populate state.workouts from the inlined HISTORY array, resolving exercise
// names against state.exercises (creating any that don't exist).
function loadHistoryInto(s) {
  const byName = (name) => {
    let ex = s.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!ex) { ex = { id: uid(), name, defaultSets: 3, defaultRepRange: "", days: [] }; s.exercises.push(ex); }
    return ex;
  };
  HISTORY.forEach((h, i) => {
    s.workouts.push({
      id: uid(),
      date: h.d,
      day: h.day,
      notes: "",
      entries: h.e.map(en => ({
        exerciseId: byName(en.n).id,
        sets: en.s.map(([load, reps]) => ({ load, reps })),
      })),
      createdAt: Date.now() + i,
    });
  });
  s.seedHistoryLoaded = true;
}

let state = loadState();
let activeWorkoutId = null;

/* ───────── Theme ───────── */
function applyTheme() {
  const t = state.settings.theme;
  if (t === "auto") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
}

/* ───────── Navigation ───────── */
function showView(name) {
  $$(".view").forEach(v => v.classList.toggle("active", v.id === `view-${name}`));
  $$(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  if (name === "today") renderToday();
  if (name === "history") renderHistory();
  if (name === "progress") renderProgress();
  if (name === "library") renderLibrary();
  if (name === "health") renderHealth();
  if (name === "settings") renderSettings();
}

/* ───────── Toast ───────── */
let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ───────── Today view ───────── */
function ensureActiveWorkout() {
  // If we already have one in progress (saved with empty entries), reuse it.
  // Otherwise create a fresh transient one (only saved on "Save workout").
  if (activeWorkoutId) return getWorkout(activeWorkoutId);
  return null;
}
function getWorkout(id) { return state.workouts.find(w => w.id === id); }

function openTemplateChooser() {
  const grid = $("#template-grid");
  const tiles = [];
  Object.entries(TEMPLATES).forEach(([name, t]) => {
    const preview = t.exercises.slice(0, 3).join(" · ") + (t.exercises.length > 3 ? `  +${t.exercises.length - 3}` : "");
    tiles.push(`
      <button class="template-tile" data-template="${escapeHtml(name)}">
        <div class="tile-name">${escapeHtml(name)} <span class="tile-count">${t.exercises.length}</span></div>
        <div class="tile-sub">${escapeHtml(t.subtitle)}</div>
        <div class="tile-list">${escapeHtml(preview)}</div>
      </button>`);
  });
  tiles.push(`
    <button class="template-tile blank" data-template="">
      <div class="tile-name">Blank</div>
      <div class="tile-sub">Start with no exercises</div>
      <div class="tile-list">Add what you want as you go</div>
    </button>`);
  grid.innerHTML = tiles.join("");
  grid.querySelectorAll(".template-tile").forEach(el => {
    el.onclick = () => {
      closeTemplateChooser();
      startNewWorkout(el.dataset.template);
    };
  });
  $("#template-modal").classList.remove("hidden");
}
function closeTemplateChooser() {
  $("#template-modal").classList.add("hidden");
}

function startNewWorkout(templateName = "") {
  const w = {
    id: uid(),
    date: todayISO(),
    day: templateName,
    notes: "",
    entries: [],
    createdAt: Date.now(),
  };
  state.workouts.push(w);
  activeWorkoutId = w.id;
  if (templateName && TEMPLATES[templateName]) {
    TEMPLATES[templateName].exercises.forEach(name => {
      const ex = findOrCreateExercise(name);
      addEntry(ex.id);
    });
  }
  saveState();
  renderToday();
}

function findOrCreateExercise(name) {
  let ex = state.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (!ex) {
    ex = { id: uid(), name, defaultSets: 3, defaultRepRange: "", days: [] };
    state.exercises.push(ex);
  }
  return ex;
}

function addEntry(exerciseId) {
  const w = getWorkout(activeWorkoutId);
  if (!w) return;
  const ex = state.exercises.find(e => e.id === exerciseId);
  const n = ex?.defaultSets ?? 3;
  const sets = [];
  for (let i = 0; i < n; i++) sets.push({ load: "", reps: "" });
  w.entries.push({ exerciseId, sets });
  saveState();
}

function discardWorkout() {
  if (!activeWorkoutId) return;
  if (!confirm("Discard this workout? Nothing will be saved.")) return;
  state.workouts = state.workouts.filter(w => w.id !== activeWorkoutId);
  activeWorkoutId = null;
  saveState();
  renderToday();
  toast("Workout discarded");
}

function finishWorkout() {
  const w = getWorkout(activeWorkoutId);
  if (!w) return;
  // Strip out empty sets but keep at least one per entry
  w.entries.forEach(e => {
    e.sets = e.sets.filter((s, i) => i === 0 || s.load !== "" || s.reps !== "");
  });
  // Strip out entries with no logged data at all
  const hasAnyData = w.entries.some(e => e.sets.some(s => s.load !== "" || s.reps !== ""));
  if (!hasAnyData) {
    if (!confirm("This workout has no logged sets. Save anyway?")) return;
  }
  saveState();
  activeWorkoutId = null;
  renderToday();
  toast("Workout saved");
  showView("history");
}

function renderToday() {
  $("#today-date").textContent = new Date().toLocaleDateString(undefined,
    {weekday:"long", month:"long", day:"numeric"});

  const dropdown = $("#workout-day");
  dropdown.innerHTML = '<option value="">(no label)</option>';
  // Build union of template names + day-labels that already exist on workouts
  const labels = new Set([
    ...Object.keys(TEMPLATES),
    ...state.workouts.map(w => w.day).filter(Boolean),
  ]);
  Array.from(labels).sort().forEach(d => {
    const opt = document.createElement("option");
    opt.value = d; opt.textContent = d;
    dropdown.appendChild(opt);
  });

  const w = ensureActiveWorkout();
  if (!w) {
    $("#active-workout").classList.add("hidden");
    $("#no-workout").classList.remove("hidden");
    return;
  }
  $("#no-workout").classList.add("hidden");
  $("#active-workout").classList.remove("hidden");

  $("#workout-date").value = w.date;
  $("#workout-day").value = w.day || "";
  $("#workout-notes").value = w.notes || "";

  const entries = $("#entries");
  entries.innerHTML = "";
  w.entries.forEach((entry, i) => entries.appendChild(renderEntry(entry, i)));
}

function renderEntry(entry, idx) {
  const ex = state.exercises.find(e => e.id === entry.exerciseId);
  if (!ex) return document.createElement("div");
  const w = getWorkout(activeWorkoutId);

  // Previous-week reference for this exercise
  const prevSession = state.workouts
    .filter(x => x.id !== w.id && x.entries.some(e => e.exerciseId === ex.id))
    .sort((a,b) => b.date.localeCompare(a.date))[0];
  const prevSets = prevSession?.entries.find(e => e.exerciseId === ex.id)?.sets ?? [];

  const div = document.createElement("div");
  div.className = "entry";
  div.dataset.idx = idx;

  const u = state.settings.units;

  const setRows = entry.sets.map((s, si) => {
    const prev = prevSets[si];
    const prevText = prev && prev.load !== "" && prev.reps !== ""
      ? `${parseNum(prev.load)}×${parseNum(prev.reps)}`
      : "—";
    return `
      <tr>
        <td class="set-num">${si+1}</td>
        <td><input class="inp-load" type="number" inputmode="decimal" step="0.5" min="0" value="${s.load}" placeholder="${u}"></td>
        <td><input class="inp-reps" type="number" inputmode="numeric" step="1" min="0" value="${s.reps}" placeholder="reps"></td>
        <td class="col-prev">${prevText}</td>
        <td class="col-actions"><button class="icon-btn danger btn-remove-set" aria-label="Remove set">×</button></td>
      </tr>`;
  }).join("");

  div.innerHTML = `
    <div class="entry-head">
      <div>
        <div class="entry-name">${escapeHtml(ex.name)}</div>
        <div class="entry-sub">${ex.defaultSets || entry.sets.length} sets · ${escapeHtml(ex.defaultRepRange || "")}</div>
      </div>
      <div class="entry-actions">
        <button class="icon-btn btn-add-set" aria-label="Add set">+</button>
        <button class="icon-btn danger btn-remove-entry" aria-label="Remove exercise">🗑</button>
      </div>
    </div>
    <table class="sets-table">
      <thead><tr><th>#</th><th>${u}</th><th>Reps</th><th>Prev</th><th></th></tr></thead>
      <tbody>${setRows}</tbody>
    </table>
    <div class="entry-footer">
      <div class="entry-stats">
        <span>Vol <strong class="stat-vol">0</strong></span>
        <span>e1RM <strong class="stat-1rm">0</strong></span>
        <span class="stat-delta"></span>
      </div>
    </div>
  `;

  // Wire up handlers
  div.querySelector(".btn-add-set").onclick = () => {
    entry.sets.push({ load: "", reps: "" });
    saveState();
    renderToday();
  };
  div.querySelector(".btn-remove-entry").onclick = () => {
    w.entries.splice(idx, 1);
    saveState();
    renderToday();
  };
  div.querySelectorAll(".btn-remove-set").forEach((btn, si) => {
    btn.onclick = () => {
      entry.sets.splice(si, 1);
      if (entry.sets.length === 0) entry.sets.push({ load: "", reps: "" });
      saveState();
      renderToday();
    };
  });
  div.querySelectorAll(".inp-load").forEach((inp, si) => {
    inp.addEventListener("input", () => { entry.sets[si].load = inp.value; saveState(); updateEntryStats(div, entry, prevSets); });
  });
  div.querySelectorAll(".inp-reps").forEach((inp, si) => {
    inp.addEventListener("input", () => { entry.sets[si].reps = inp.value; saveState(); updateEntryStats(div, entry, prevSets); });
  });

  updateEntryStats(div, entry, prevSets);
  return div;
}

function updateEntryStats(div, entry, prevSets) {
  let vol = 0, best1rm = 0;
  entry.sets.forEach(s => {
    const v = setVolume(s.load, s.reps);
    vol += v;
    const r = oneRM(parseNum(s.load), parseNum(s.reps));
    if (r > best1rm) best1rm = r;
  });
  let prevVol = 0;
  prevSets.forEach(s => { prevVol += setVolume(s.load, s.reps); });

  div.querySelector(".stat-vol").textContent = fmt(vol);
  div.querySelector(".stat-1rm").textContent = fmt(best1rm, 1);
  const delta = div.querySelector(".stat-delta");
  if (prevVol > 0) {
    const diff = vol - prevVol;
    if (Math.abs(diff) < 0.001) {
      delta.textContent = "= same";
      delta.className = "stat-delta";
    } else if (diff > 0) {
      delta.innerHTML = `<span class="delta-up">▲ +${fmt(diff)}</span>`;
    } else {
      delta.innerHTML = `<span class="delta-down">▼ ${fmt(diff)}</span>`;
    }
  } else {
    delta.textContent = "";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ───────── Exercise picker ───────── */
function openPicker(onPick) {
  const modal = $("#picker-modal");
  const list = $("#picker-list");
  const search = $("#picker-search");
  const createBtn = $("#btn-picker-create");
  search.value = "";

  function renderList() {
    const q = search.value.trim().toLowerCase();
    const matches = state.exercises
      .filter(e => !q || e.name.toLowerCase().includes(q))
      .sort((a,b) => a.name.localeCompare(b.name));
    list.innerHTML = matches.map(e => `
      <div class="picker-item" data-id="${e.id}">
        <div>
          <div>${escapeHtml(e.name)}</div>
          <div class="picker-item-meta">${e.defaultSets}×${escapeHtml(e.defaultRepRange || "?")} · ${e.days.join(", ") || "no day"}</div>
        </div>
      </div>`).join("");
    list.querySelectorAll(".picker-item").forEach(el => {
      el.onclick = () => { onPick(el.dataset.id); closePicker(); };
    });
    // Show "create" button if no exact match
    const exact = state.exercises.some(e => e.name.toLowerCase() === q);
    if (q && !exact) {
      createBtn.classList.remove("hidden");
      $("#picker-create-name").textContent = search.value.trim();
    } else {
      createBtn.classList.add("hidden");
    }
  }
  createBtn.onclick = () => {
    const ex = { id: uid(), name: search.value.trim(), defaultSets: 3, defaultRepRange: "", days: [] };
    state.exercises.push(ex);
    saveState();
    onPick(ex.id);
    closePicker();
  };
  search.oninput = renderList;
  renderList();
  modal.classList.remove("hidden");
  setTimeout(() => search.focus(), 100);
}
function closePicker() { $("#picker-modal").classList.add("hidden"); }

/* ───────── History view ───────── */
function renderHistory() {
  const list = $("#history-list");
  const filter = $("#history-filter");

  // Populate filter once
  if (filter.options.length < 2) {
    state.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.id; opt.textContent = e.name;
      filter.appendChild(opt);
    });
    filter.onchange = renderHistory;
  }

  const filterId = filter.value;
  let items = state.workouts
    .filter(w => w.id !== activeWorkoutId) // hide in-progress
    .filter(w => !filterId || w.entries.some(e => e.exerciseId === filterId))
    .sort((a,b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

  if (items.length === 0) {
    list.innerHTML = `<div class="card muted" style="text-align:center;padding:40px 16px">No saved workouts yet.</div>`;
    return;
  }

  list.innerHTML = items.map(w => {
    let totalVol = 0, totalSets = 0;
    w.entries.forEach(e => e.sets.forEach(s => {
      if (s.load !== "" && s.reps !== "") {
        totalVol += setVolume(s.load, s.reps);
        totalSets++;
      }
    }));
    const detail = w.entries.map(e => {
      const ex = state.exercises.find(x => x.id === e.exerciseId);
      const setsText = e.sets
        .filter(s => s.load !== "" || s.reps !== "")
        .map(s => `${parseNum(s.load)}×${parseNum(s.reps)}`)
        .join("  ·  ");
      return `<div class="history-exercise">
        <div class="history-exercise-name">${escapeHtml(ex?.name || "Unknown")}</div>
        <div class="history-sets">${setsText || "(no sets)"}</div>
      </div>`;
    }).join("");
    return `
      <div class="history-item" data-id="${w.id}">
        <div class="history-item-head">
          <div>
            <div class="history-item-date">${prettyDate(w.date)}</div>
            <div class="history-item-day">${escapeHtml(w.day || "")} ${w.notes ? "· " + escapeHtml(w.notes) : ""}</div>
          </div>
          <div class="history-item-actions">
            <button class="icon-btn btn-edit-workout" aria-label="Edit">✎</button>
            <button class="icon-btn danger btn-del-workout" aria-label="Delete">×</button>
          </div>
        </div>
        <div class="history-item-stats">
          <span>Volume <strong>${fmt(totalVol)}</strong> ${state.settings.units}</span>
          <span>Sets <strong>${totalSets}</strong></span>
          <span>Exercises <strong>${w.entries.length}</strong></span>
        </div>
        <div class="history-detail">${detail}</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".history-item").forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest(".btn-del-workout") || e.target.closest(".btn-edit-workout")) return;
      el.classList.toggle("open");
    };
    el.querySelector(".btn-edit-workout").onclick = (e) => {
      e.stopPropagation();
      activeWorkoutId = el.dataset.id;
      showView("today");
    };
    el.querySelector(".btn-del-workout").onclick = (e) => {
      e.stopPropagation();
      if (!confirm("Delete this workout?")) return;
      state.workouts = state.workouts.filter(w => w.id !== el.dataset.id);
      saveState();
      renderHistory();
      toast("Deleted");
    };
  });
}

/* ───────── Progress view ───────── */
let chartTotalVolume, chartExerciseVolume, chartExercise1rm;

function renderProgress() {
  const ex = $("#progress-exercise");
  if (ex.options.length === 0) {
    state.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(e => {
      const opt = document.createElement("option"); opt.value = e.id; opt.textContent = e.name;
      ex.appendChild(opt);
    });
    ex.onchange = () => renderExerciseCharts(ex.value);
  }

  renderTotalVolume();
  renderExerciseCharts(ex.value || ex.options[0]?.value);
  renderWowTable();
}

function getWeekData() {
  // Returns sorted list of { weekKey, label, weekStart, totalVolume, perExercise: {exId: {volume, sets, best1rm}} }
  const map = {};
  state.workouts.filter(w => w.id !== activeWorkoutId).forEach(w => {
    const iw = isoWeek(w.date);
    if (!map[iw.key]) map[iw.key] = { weekKey: iw.key, label: iw.label, weekStart: weekStart(iw.key), totalVolume: 0, perExercise: {} };
    w.entries.forEach(e => {
      e.sets.forEach(s => {
        const v = setVolume(s.load, s.reps);
        const r = oneRM(parseNum(s.load), parseNum(s.reps));
        if (v <= 0 && r <= 0) return;
        map[iw.key].totalVolume += v;
        if (!map[iw.key].perExercise[e.exerciseId]) {
          map[iw.key].perExercise[e.exerciseId] = { volume: 0, sets: 0, best1rm: 0 };
        }
        const slot = map[iw.key].perExercise[e.exerciseId];
        slot.volume += v;
        if (s.load !== "" && s.reps !== "") slot.sets += 1;
        if (r > slot.best1rm) slot.best1rm = r;
      });
    });
  });
  return Object.values(map).sort((a,b) => a.weekKey.localeCompare(b.weekKey));
}

const chartBase = () => {
  const css = getComputedStyle(document.documentElement);
  return {
    text: css.getPropertyValue("--text").trim() || "#e7ebf0",
    dim: css.getPropertyValue("--text-dim").trim() || "#8b95a4",
    accent: css.getPropertyValue("--accent").trim() || "#6ea8ff",
    grid: css.getPropertyValue("--border").trim() || "#262d36",
  };
};

function makeLineChart(canvas, labels, datasets) {
  const c = chartBase();
  return new Chart(canvas, {
    type: "line",
    data: { labels, datasets: datasets.map(d => ({
      tension: 0.25,
      borderColor: d.color || c.accent,
      backgroundColor: (d.color || c.accent) + "33",
      pointBackgroundColor: d.color || c.accent,
      pointRadius: 4,
      borderWidth: 2,
      fill: true,
      ...d,
    })) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1, labels: { color: c.text } } },
      scales: {
        x: { ticks: { color: c.dim }, grid: { color: c.grid, display: false } },
        y: { ticks: { color: c.dim }, grid: { color: c.grid }, beginAtZero: true },
      },
    },
  });
}

function renderTotalVolume() {
  const data = getWeekData();
  if (chartTotalVolume) chartTotalVolume.destroy();
  if (data.length === 0) return;
  chartTotalVolume = makeLineChart(
    $("#chart-total-volume"),
    data.map(d => d.label),
    [{ label: `Total volume (${state.settings.units})`, data: data.map(d => Math.round(d.totalVolume)) }]
  );
}

function renderExerciseCharts(exId) {
  if (chartExerciseVolume) chartExerciseVolume.destroy();
  if (chartExercise1rm) chartExercise1rm.destroy();
  const metrics = $("#progress-metrics");
  metrics.innerHTML = "";
  if (!exId) return;

  const data = getWeekData();
  const points = data.map(d => ({
    label: d.label,
    volume: d.perExercise[exId]?.volume || 0,
    best1rm: d.perExercise[exId]?.best1rm || 0,
    sets: d.perExercise[exId]?.sets || 0,
  })).filter(p => p.volume > 0 || p.best1rm > 0);

  if (points.length === 0) {
    metrics.innerHTML = `<div class="muted small">No data yet for this exercise.</div>`;
    return;
  }

  const cur = points[points.length-1];
  const prev = points[points.length-2];

  const card = (label, value, delta) => {
    const cls = delta > 0 ? "up" : delta < 0 ? "down" : "";
    const sign = delta > 0 ? "+" : "";
    const deltaHtml = (delta !== null && Number.isFinite(delta) && delta !== 0)
      ? `<div class="metric-delta ${cls}">${sign}${fmt(delta, 1)}</div>` : "";
    return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div>${deltaHtml}</div>`;
  };
  metrics.innerHTML = [
    card(`Volume (${state.settings.units})`, fmt(cur.volume), prev ? cur.volume - prev.volume : null),
    card(`Best e1RM (${state.settings.units})`, fmt(cur.best1rm, 1), prev ? cur.best1rm - prev.best1rm : null),
    card("Sets this week", String(cur.sets), prev ? cur.sets - prev.sets : null),
  ].join("");

  const c = chartBase();
  chartExerciseVolume = makeLineChart(
    $("#chart-exercise-volume"),
    points.map(p => p.label),
    [{ label: "Volume", data: points.map(p => Math.round(p.volume)) }]
  );
  chartExercise1rm = makeLineChart(
    $("#chart-exercise-1rm"),
    points.map(p => p.label),
    [{ label: "Estimated 1RM", data: points.map(p => +p.best1rm.toFixed(1)), color: c.accent }]
  );
}

function renderWowTable() {
  const tbl = $("#wow-table");
  const data = getWeekData();
  if (data.length === 0) { tbl.innerHTML = ""; return; }
  const recentWeeks = data.slice(-6); // up to 6 most recent weeks
  // Header
  const headers = recentWeeks.map(w => `<th>${w.label}</th>`).join("");
  const exerciseIds = new Set();
  recentWeeks.forEach(w => Object.keys(w.perExercise).forEach(id => exerciseIds.add(id)));
  const rows = Array.from(exerciseIds).map(id => {
    const ex = state.exercises.find(e => e.id === id);
    if (!ex) return "";
    const cells = recentWeeks.map((w, i) => {
      const v = w.perExercise[id]?.volume || 0;
      const prev = i > 0 ? (recentWeeks[i-1].perExercise[id]?.volume || 0) : 0;
      let arrow = "";
      if (i > 0 && prev > 0 && v > 0) {
        const d = v - prev;
        if (d > 0) arrow = `<span class="up"> ▲${fmt(d)}</span>`;
        else if (d < 0) arrow = `<span class="down"> ▼${fmt(d)}</span>`;
      }
      return `<td>${v ? fmt(v) : "—"}${arrow}</td>`;
    }).join("");
    return `<tr><td>${escapeHtml(ex.name)}</td>${cells}</tr>`;
  }).join("");
  tbl.innerHTML = `<thead><tr><th>Exercise</th>${headers}</tr></thead><tbody>${rows}</tbody>`;
}

/* ───────── Library view ───────── */
function renderLibrary() {
  const list = $("#library-list");
  const q = ($("#library-search").value || "").trim().toLowerCase();
  const items = state.exercises
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .sort((a,b) => a.name.localeCompare(b.name));
  if (items.length === 0) {
    list.innerHTML = `<div class="card muted" style="text-align:center;padding:30px">No exercises match.</div>`;
    return;
  }
  list.innerHTML = items.map(e => `
    <div class="library-item" data-id="${e.id}">
      <div>
        <div class="library-name">${escapeHtml(e.name)}</div>
        <div class="library-meta">${e.defaultSets}×${escapeHtml(e.defaultRepRange || "?")} ${e.days.map(d => `<span class="tag">${d}</span>`).join("")}</div>
      </div>
      <span class="muted">›</span>
    </div>`).join("");
  list.querySelectorAll(".library-item").forEach(el => {
    el.onclick = () => openExerciseEditor(el.dataset.id);
  });
}

function openExerciseEditor(id) {
  const modal = $("#exercise-edit-modal");
  const title = $("#exercise-edit-title");
  const nameInp = $("#exercise-edit-name");
  const setsInp = $("#exercise-edit-sets");
  const repInp = $("#exercise-edit-reprange");
  const daysInp = $("#exercise-edit-days");
  const delBtn = $("#btn-exercise-edit-delete");

  const isNew = !id;
  const ex = isNew ? { id: uid(), name: "", defaultSets: 3, defaultRepRange: "", days: [] } : state.exercises.find(e => e.id === id);
  if (!ex) return;
  title.textContent = isNew ? "New exercise" : "Edit exercise";
  nameInp.value = ex.name;
  setsInp.value = ex.defaultSets;
  repInp.value = ex.defaultRepRange;
  daysInp.value = ex.days.join(", ");
  delBtn.style.display = isNew ? "none" : "inline-flex";

  $("#btn-exercise-edit-save").onclick = () => {
    const name = nameInp.value.trim();
    if (!name) { toast("Name is required"); return; }
    ex.name = name;
    ex.defaultSets = parseInt(setsInp.value) || 3;
    ex.defaultRepRange = repInp.value.trim();
    ex.days = daysInp.value.split(",").map(d => d.trim()).filter(Boolean);
    if (isNew) state.exercises.push(ex);
    // Update day lists too
    Object.keys(state.days).forEach(d => {
      state.days[d] = state.days[d].filter(n => n.toLowerCase() !== ex.name.toLowerCase());
    });
    ex.days.forEach(d => {
      state.days[d] = state.days[d] || [];
      if (!state.days[d].includes(ex.name)) state.days[d].push(ex.name);
    });
    saveState();
    modal.classList.add("hidden");
    renderLibrary();
    toast(isNew ? "Added" : "Saved");
  };
  delBtn.onclick = () => {
    if (!confirm(`Delete ${ex.name}? Past workouts that reference it will keep their data, but the exercise won't appear in the library.`)) return;
    state.exercises = state.exercises.filter(e => e.id !== ex.id);
    Object.keys(state.days).forEach(d => {
      state.days[d] = state.days[d].filter(n => n.toLowerCase() !== ex.name.toLowerCase());
    });
    saveState();
    modal.classList.add("hidden");
    renderLibrary();
    toast("Deleted");
  };

  modal.classList.remove("hidden");
  setTimeout(() => nameInp.focus(), 100);
}

/* ───────── Health view ───────── */
let healthCurrentDate = null;

function renderHealth() {
  const date = healthCurrentDate || todayISO();
  healthCurrentDate = date;

  $("#health-date").value = date;
  $("#balance-date-label").textContent = prettyDate(date);

  // Macros
  const n = getNutritionFor(date);
  $("#m-protein").value = n.protein;
  $("#m-carbs").value = n.carbs;
  $("#m-fat").value = n.fat;
  $("#m-notes").value = n.notes;
  updateMacroDisplay(n);

  // Profile
  const p = state.profile;
  $("#p-height").value = p.height;
  $("#p-weight").value = p.weight;
  $("#p-age").value = p.age;
  $("#p-sex").value = p.sex;
  $("#p-activity").value = p.activity;
  updateProfileDisplay(p);

  // Health snapshot
  renderHealthSnapshot();

  // Energy balance
  updateBalance(date, n);
}

function updateMacroDisplay(n) {
  const p = parseNum(n.protein), c = parseNum(n.carbs), f = parseNum(n.fat);
  $("#m-protein-kcal").textContent = `${fmt(p*4)} kcal`;
  $("#m-carbs-kcal").textContent = `${fmt(c*4)} kcal`;
  $("#m-fat-kcal").textContent = `${fmt(f*9)} kcal`;
  $("#macro-total").textContent = `${fmt(macrosToKcal(n))} kcal`;
}

function updateProfileDisplay(p) {
  const bmi = calcBMI(p);
  const bmr = calcBMR(p);
  const tdee = calcTDEE(p);
  $("#p-bmi").textContent = bmi ? bmi.toFixed(1) : "—";
  $("#p-bmi-cat").textContent = bmiCategory(bmi);
  $("#p-bmr").textContent = bmr ? fmt(bmr) : "—";
  $("#p-tdee").textContent = tdee ? fmt(tdee) : "—";
}

function updateBalance(date, n) {
  const intake = macrosToKcal(n);
  const tdee = calcTDEE(state.profile);
  // If we have today's active-energy from Health, use BMR + active. Else fall back to TDEE.
  let outputKcal = tdee;
  let outputLabel = "TDEE estimate";
  const h = state.health.data;
  if (h && date === todayISO() && h.activeEnergyToday != null) {
    const bmr = calcBMR(state.profile);
    outputKcal = bmr + parseNum(h.activeEnergyToday);
    outputLabel = `BMR + ${fmt(h.activeEnergyToday)} active`;
  }
  $("#bal-intake").textContent = fmt(intake);
  $("#bal-output").textContent = fmt(outputKcal);
  $("#bal-output-sub").textContent = outputLabel;

  const net = intake - outputKcal;
  const netEl = $("#bal-net");
  if (intake === 0) {
    netEl.textContent = "Log macros to see balance";
    netEl.className = "bal-net muted";
  } else if (Math.abs(net) < 50) {
    netEl.textContent = `${fmt(net)} kcal · maintenance`;
    netEl.className = "bal-net";
  } else if (net < 0) {
    netEl.textContent = `${fmt(net)} kcal · deficit`;
    netEl.className = "bal-net deficit";
  } else {
    netEl.textContent = `+${fmt(net)} kcal · surplus`;
    netEl.className = "bal-net surplus";
  }
}

function renderHealthSnapshot() {
  const configured = !!state.settings.gistId;
  $("#health-unconfigured").classList.toggle("hidden", configured);
  $("#health-snapshot").classList.toggle("hidden", !configured);
  if (!configured) return;

  const h = state.health.data || {};
  const set = (sel, val, suffix = "") => {
    $(sel).textContent = (val == null || val === "" || Number.isNaN(+val))
      ? "—"
      : (typeof val === "number" ? (suffix === " bpm" || suffix === " kcal" || suffix === "" && Number.isInteger(val) ? fmt(Math.round(val)) : fmt(val, 1)) : val) + suffix;
  };
  set("#h-current-hr", h.currentHR, " bpm");
  set("#h-resting-hr", h.restingHR, " bpm");
  set("#h-hrv", h.hrv, " ms");
  set("#h-spo2", h.bloodOxygen, "%");
  set("#h-steps", h.stepsToday, "");
  set("#h-distance", h.distanceMiToday, " mi");
  set("#h-active", h.activeEnergyToday, " kcal");
  set("#h-resting-kcal", h.restingEnergyToday, " kcal");
  set("#h-exercise", h.exerciseMinutesToday, " min");
  set("#h-stand", h.standHoursToday, " hr");
  set("#h-sleep", h.sleepHours, " hr");
  set("#h-weight", h.weightLbs, " lbs");
  set("#h-bodyfat", h.bodyFatPct, "%");

  let updated = relativeTime(state.health.lastFetch);
  if (state.health.lastError) updated += ` · ⚠ ${state.health.lastError}`;
  $("#h-updated").textContent = updated;
}

/* Gist fetch — pulls latest Apple Health snapshot pushed by the iOS Shortcut */
async function syncHealth(force = false) {
  if (!state.settings.gistId) return;
  if (!force && state.health.lastFetch && (Date.now() - state.health.lastFetch < 5 * 60 * 1000)) {
    return; // 5-min cache
  }
  try {
    const res = await fetch(`https://api.github.com/gists/${state.settings.gistId}`, {
      headers: { "Accept": "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const gist = await res.json();
    const file = gist.files["health.json"] || Object.values(gist.files).find(f => f.filename.endsWith(".json"));
    if (!file) throw new Error("No JSON file in gist");
    const text = file.truncated
      ? await fetch(file.raw_url).then(r => r.text())
      : file.content;
    const data = JSON.parse(text);
    state.health.data = data;
    state.health.lastFetch = Date.now();
    state.health.lastError = null;
    saveState();
    renderHealthSnapshot();
    updateBalance(healthCurrentDate || todayISO(), getNutritionFor(healthCurrentDate || todayISO()));
  } catch (e) {
    console.error("Health sync failed:", e);
    state.health.lastError = e.message;
    saveState();
    renderHealthSnapshot();
  }
}

/* ───────── Settings ───────── */
function renderSettings() {
  $("#setting-units").value = state.settings.units;
  $("#setting-theme").value = state.settings.theme;
  $("#setting-gist-id").value = state.settings.gistId || "";
  $("#app-version").textContent = APP_VERSION;
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `workout-tracker-${todayISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Exported");
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const obj = JSON.parse(reader.result);
      if (!obj.workouts || !obj.exercises) throw new Error("Missing fields");
      if (!confirm(`Replace all data with this file? (${obj.workouts.length} workouts, ${obj.exercises.length} exercises)`)) return;
      state = migrate(obj);
      activeWorkoutId = null;
      saveState();
      applyTheme();
      // Reset filter dropdowns
      $("#history-filter").innerHTML = '<option value="">All exercises</option>';
      $("#progress-exercise").innerHTML = "";
      showView("today");
      toast("Imported");
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
}

/* ───────── Init ───────── */
function bindEvents() {
  $$(".nav-btn").forEach(b => b.onclick = () => showView(b.dataset.view));

  $("#btn-new-workout").onclick = openTemplateChooser;
  $("#btn-new-workout-empty").onclick = openTemplateChooser;
  $("#btn-template-close").onclick = closeTemplateChooser;
  $("#btn-save-workout").onclick = finishWorkout;
  $("#btn-discard-workout").onclick = discardWorkout;
  $("#btn-add-exercise").onclick = () => {
    openPicker(exId => {
      addEntry(exId);
      saveState();
      renderToday();
    });
  };
  $("#btn-picker-close").onclick = closePicker;

  $("#workout-date").addEventListener("change", e => {
    const w = getWorkout(activeWorkoutId); if (w) { w.date = e.target.value; saveState(); }
  });
  $("#workout-day").addEventListener("change", e => {
    const w = getWorkout(activeWorkoutId);
    if (!w) return;
    w.day = e.target.value;
    saveState();
  });
  $("#workout-notes").addEventListener("input", e => {
    const w = getWorkout(activeWorkoutId); if (w) { w.notes = e.target.value; saveState(); }
  });

  $("#library-search").addEventListener("input", renderLibrary);
  $("#btn-add-library").onclick = () => openExerciseEditor(null);
  $("#btn-exercise-edit-close").onclick = () => $("#exercise-edit-modal").classList.add("hidden");

  $("#setting-units").onchange = e => { state.settings.units = e.target.value; saveState(); renderToday(); };
  $("#setting-theme").onchange = e => { state.settings.theme = e.target.value; saveState(); applyTheme(); };
  $("#btn-open-library").onclick = () => showView("library");
  $("#setting-gist-id").addEventListener("input", e => {
    state.settings.gistId = e.target.value.trim();
    saveState();
    const status = $("#setting-gist-status");
    status.textContent = state.settings.gistId ? "Saved. Switch to Health to test." : "";
  });
  $("#btn-show-shortcut-help").onclick = (e) => {
    e.preventDefault();
    $("#shortcut-help").classList.toggle("hidden");
  };

  // Health view inputs
  $("#health-date").addEventListener("change", e => {
    healthCurrentDate = e.target.value;
    renderHealth();
  });
  ["protein","carbs","fat"].forEach(k => {
    $(`#m-${k}`).addEventListener("input", e => {
      const date = healthCurrentDate || todayISO();
      const n = upsertNutrition(date, { [k]: e.target.value });
      updateMacroDisplay(n);
      updateBalance(date, n);
    });
  });
  $("#m-notes").addEventListener("input", e => {
    upsertNutrition(healthCurrentDate || todayISO(), { notes: e.target.value });
  });
  ["height","weight","age"].forEach(k => {
    $(`#p-${k}`).addEventListener("input", e => {
      state.profile[k] = parseNum(e.target.value);
      saveState();
      updateProfileDisplay(state.profile);
      updateBalance(healthCurrentDate || todayISO(), getNutritionFor(healthCurrentDate || todayISO()));
    });
  });
  ["sex","activity"].forEach(k => {
    $(`#p-${k}`).addEventListener("change", e => {
      state.profile[k] = e.target.value;
      saveState();
      updateProfileDisplay(state.profile);
      updateBalance(healthCurrentDate || todayISO(), getNutritionFor(healthCurrentDate || todayISO()));
    });
  });
  $("#btn-health-refresh").onclick = () => syncHealth(true);

  $("#btn-export").onclick = exportJSON;
  $("#btn-import").onclick = () => $("#import-file").click();
  $("#import-file").onchange = e => { if (e.target.files[0]) importJSON(e.target.files[0]); };
  $("#btn-wipe").onclick = () => {
    if (!confirm("Erase ALL workouts, exercises, and settings? This cannot be undone.")) return;
    if (!confirm("Are you absolutely sure?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = defaultState();
    activeWorkoutId = null;
    saveState();
    applyTheme();
    $("#history-filter").innerHTML = '<option value="">All exercises</option>';
    $("#progress-exercise").innerHTML = "";
    showView("today");
    toast("All data erased");
  };

  // Close modal on backdrop click
  $$(".modal").forEach(m => {
    m.addEventListener("click", e => { if (e.target === m) m.classList.add("hidden"); });
  });

  // Watch system theme
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
      if (state.settings.theme === "auto") applyTheme();
    });
  }
}

function init() {
  applyTheme();
  bindEvents();
  // Accept ?gist=<id> in the URL to auto-configure on first tap
  const urlGist = new URL(location.href).searchParams.get("gist");
  if (urlGist && urlGist !== state.settings.gistId) {
    state.settings.gistId = urlGist;
    saveState();
    toast("Apple Health gist configured");
    history.replaceState({}, "", location.pathname);
  }
  // Kick off a background Health sync if a Gist is configured
  if (state.settings.gistId) syncHealth();
  // If there's an in-progress workout (last one with empty entries from a refresh), revive it
  const inProgress = state.workouts.find(w => w.date === todayISO() && w.entries.length > 0 && w.entries.some(e => e.sets.some(s => s.load === "" && s.reps === "")));
  // Don't auto-revive — make user explicitly start. activeWorkoutId stays null.
  showView("today");
}

init();
