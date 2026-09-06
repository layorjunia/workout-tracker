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
    // Cardio (added v2)
    {name:"Running (Treadmill)",   type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"Running (Outdoor)",     type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"Stationary Bike",       type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"Elliptical",            type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"Rowing Machine (Erg)",  type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"StairMaster",           type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"Incline Walk",          type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    {name:"HIIT",                  type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
    // Timed holds (seconds per set)
    {name:"Plank",                 type:"timed", defaultSets:3, defaultRepRange:"45–60s", days:[]},
    {name:"Side Plank",            type:"timed", defaultSets:3, defaultRepRange:"30–45s", days:[]},
    {name:"Dead Hang",             type:"timed", defaultSets:3, defaultRepRange:"30–60s", days:[]},
    {name:"Wall Sit",              type:"timed", defaultSets:3, defaultRepRange:"45–60s", days:[]},
    // Bodyweight (reps only)
    {name:"Push-ups",              type:"bodyweight", defaultSets:3, defaultRepRange:"15–25", days:[]},
    {name:"Sit-ups",               type:"bodyweight", defaultSets:3, defaultRepRange:"15–25", days:[]},
    {name:"Burpees",               type:"bodyweight", defaultSets:3, defaultRepRange:"10–15", days:[]},
    {name:"Bodyweight Squats",     type:"bodyweight", defaultSets:3, defaultRepRange:"15–25", days:[]},
    {name:"Lunges",                type:"bodyweight", defaultSets:3, defaultRepRange:"10–15", days:[]},
    // Riding-specific (added v3)
    {name:"Bird Dog",              type:"bodyweight", defaultSets:3, defaultRepRange:"12/side", days:[]},
    {name:"Superman",              type:"bodyweight", defaultSets:3, defaultRepRange:"15", days:[]},
    {name:"Russian Twists",        type:"bodyweight", defaultSets:3, defaultRepRange:"20 (10/side)", days:[]},
    {name:"Two-Point Hold",        type:"timed", defaultSets:4, defaultRepRange:"max · freestanding", days:[]},
    {name:"Single-Leg Balance Hold", type:"timed", defaultSets:3, defaultRepRange:"30–45s/leg", days:[]},
    {name:"Bulgarian Split Squat", defaultSets:3, defaultRepRange:"10/leg", days:[]},
    {name:"Sumo Squat",            defaultSets:3, defaultRepRange:"15", days:[]},
    {name:"Single-Leg Romanian Deadlift", defaultSets:3, defaultRepRange:"10/leg", days:[]},
    {name:"Horseback Riding",      type:"cardio", defaultSets:1, defaultRepRange:"", days:[]},
  ],
};

// Exercise types and how their sets are logged.
const EXERCISE_TYPES = {
  strength:   { label: "Strength",   hint: "weight × reps" },
  bodyweight: { label: "Bodyweight", hint: "reps only" },
  timed:      { label: "Timed",      hint: "seconds per set" },
  cardio:     { label: "Cardio",     hint: "duration · distance · heart rate" },
};
function exerciseType(ex) { return EXERCISE_TYPES[ex?.type] ? ex.type : "strength"; }
function blankSet(type) {
  switch (type) {
    case "cardio":     return { duration: "", distance: "", avgHR: "" };
    case "timed":      return { seconds: "" };
    case "bodyweight": return { reps: "", load: "" };   // load = added weight (belt/vest), optional
    default:           return { load: "", reps: "" };
  }
}
// Reshape an entry's sets to the exercise's current type, keeping any fields the
// two shapes share (reps/load survive strength ↔ bodyweight; cardio resets).
function normalizeEntrySets(entry, type) {
  const shape = Object.keys(blankSet(type));
  let changed = false;
  entry.sets = (entry.sets || []).map(s => {
    const keys = Object.keys(s || {});
    if (keys.length === shape.length && keys.every(k => shape.includes(k))) return s;
    const out = blankSet(type);
    for (const k of shape) if (s && s[k] !== undefined) out[k] = s[k];
    changed = true;
    return out;
  });
  if (!entry.sets.length) { entry.sets.push(blankSet(type)); changed = true; }
  if (changed) saveState();
}
function setHasData(s) {
  return Object.values(s || {}).some(v => v !== "" && v != null);
}

// Default workout templates — copied into state.templates on first launch.
// User edits live on state.templates; this constant is only the seed.
// v2 (2026-07): updated to reflect what Jacob actually does now per recent workout logs.
const DEFAULT_TEMPLATES = [
  {
    id: "tpl-push",
    name: "Push",
    subtitle: "Chest · Shoulders · Triceps",
    exercises: [
      "Bench Press",
      "Decline Chest Press - Barbell",
      "Overhead Military Press",
      "Dumbbell Side Lateral Raise",
      "Pectoral Fly",
      "Tricep Cable Pushdown",
    ],
  },
  {
    id: "tpl-pull",
    name: "Pull",
    subtitle: "Back · Biceps",
    exercises: [
      "Row Machine",
      "Lat Pulldown",
      "Preacher Curl",
      "Hammer Dumbbell Curl",
      "Cable Face Pull",
    ],
  },
  {
    id: "tpl-legs",
    name: "Legs",
    subtitle: "Quads · Hamstrings · Glutes · Calves",
    exercises: [
      "Squats Leg Press",
      "Seated Leg Extension",
      "Leg Curl Machine",
      "Hip Abduction",
      "Standing Calf Raise",
      "Back Extension",
    ],
  },
  {
    id: "tpl-mix",
    name: "Mix",
    subtitle: "Full body · upper + lower",
    exercises: [
      "Bench Press",
      "Row Machine",
      "Squats Leg Press",
      "Preacher Curl",
      "Ab Twist Machine",
    ],
  },
  {
    id: "tpl-rider-core",
    name: "Rider Core",
    subtitle: "Position · stability · 2x/week",
    exercises: [
      "Plank",
      "Side Plank",
      "Bird Dog",
      "Superman",
      "Russian Twists",
      "Two-Point Hold",
      "Wall Sit",
    ],
  },
  {
    id: "tpl-rider-legs",
    name: "Rider Legs",
    subtitle: "Legs · balance · 1–2x/week",
    exercises: [
      "Squats",
      "Bulgarian Split Squat",
      "Sumo Squat",
      "Single-Leg Romanian Deadlift",
      "Single-Leg Balance Hold",
      "Two-Point Hold",
      "Wall Sit",
    ],
  },
  {
    id: "tpl-cardio",
    name: "Cardio",
    subtitle: "Walk",
    exercises: [
      "Incline Walk",
    ],
  },
];

// Names of the ORIGINAL (v1) default template exercises — used by the migration
// to detect untouched templates that should be upgraded to v2 defaults.
const V1_DEFAULT_TEMPLATE_EXERCISES = {
  "Push": ["Seated Chest Press Machine","Pectoral Fly","Seated Shoulder Press","Dumbbell Side Lateral Raise","Tricep Cable Pushdown"],
  "Pull": ["Row Machine","Lat Pulldown","Wide Grip Pull-up (Assisted)","Preacher Curl","Cable Face Pull"],
  "Legs": ["Squats","Seated Leg Extension","Leg Curl Machine","Hip Abduction","Hip Adduction","Calf Raises"],
  "Mix":  ["Chest Press Machine","Lat Pulldown","Squats","Tricep Dips (Assisted)","Ab Twist Machine"],
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

/* ───────── Icons (inline SVG, currentColor) ───────── */
const ICON = {
  trash: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>`,
  edit:  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
  close: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
  watch: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="5" width="12" height="14" rx="3"/><path d="M9 2h6M9 22h6M12 9v3l2 1"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9Z"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 1-3s0 2 2 2c0-3-1-5 2-9Z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  cloudOff: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 17.4 8.5M20 15.5A3.5 3.5 0 0 0 17 12"/><path d="M3 3l18 18"/></svg>`,
};

/* ───────── Helpers ───────── */
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0,10);
};
const nowHHMM = () => {
  const d = new Date();
  return d.toTimeString().slice(0, 5); // "HH:MM" in local time
};
function durationMinutes(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // wrap past midnight
  return mins;
}
function durationLabel(start, end) {
  const m = durationMinutes(start, end);
  if (!m) return "—";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h} hr` : `${h}h ${r}m`;
}
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
// Effective macros for a date: anything you typed wins; otherwise what
// MyFitnessPal / Cronometer wrote to Apple Health (synced into n.health).
function effectiveNutrition(n) {
  const h = (n && n.health) || {};
  const pick = (k) => (n && n[k] !== "" && n[k] != null) ? parseNum(n[k]) : (h[k] != null ? h[k] : null);
  const protein = pick("protein"), carbs = pick("carbs"), fat = pick("fat");
  const manualAny = n && ["protein","carbs","fat"].some(k => n[k] !== "" && n[k] != null);
  // Calories: Health's logged total is more accurate than 4/4/9 when nothing was typed
  const kcal = manualAny || h.calories == null
    ? (protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9
    : h.calories;
  return { protein, carbs, fat, kcal, fromHealth: !manualAny && Object.keys(h).length > 0, hasAny: !!(protein || carbs || fat || kcal) };
}
// ── Body weight over time ──────────────────────────────────────────────────
// Readings come from the manual log (state.bodyweight) and from Apple Health
// (state.health.daily[date].weightLbs). bodyweightOn(date) returns the latest
// reading on or before that date — what you actually weighed when you did the
// pull-ups — falling back to the profile weight.
let _bwIndex = null, _bwIndexSig = null;
function bodyweightIndex() {
  const sig = (state.lastModified || 0) + ":" + (state.bodyweight?.length || 0) + ":" + Object.keys(state.health?.daily || {}).length;
  if (_bwIndex && _bwIndexSig === sig) return _bwIndex;
  const byDate = new Map();
  for (const [d, v] of Object.entries(state.health?.daily || {})) if (v && Number.isFinite(+v.weightLbs) && +v.weightLbs > 0) byDate.set(d, { date: d, lbs: +v.weightLbs, source: "health" });
  for (const e of state.bodyweight || []) if (e && e.date && Number.isFinite(+e.lbs) && +e.lbs > 0) byDate.set(e.date, { date: e.date, lbs: +e.lbs, source: e.source || "manual" }); // manual wins for the same day
  _bwIndex = Array.from(byDate.values()).sort((x, y) => x.date.localeCompare(y.date));
  _bwIndexSig = sig;
  return _bwIndex;
}
function bodyweightOn(date) {
  const idx = bodyweightIndex();
  let lo = 0, hi = idx.length - 1, best = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (idx[m].date <= date) { best = idx[m]; lo = m + 1; } else hi = m - 1; }
  if (best) return { lbs: best.lbs, date: best.date, source: best.source };
  const p = state.profile?.weight;
  return p ? { lbs: +p, date: null, source: "profile" } : null;
}
function latestBodyweight() {
  const idx = bodyweightIndex();
  return idx.length ? idx[idx.length - 1] : (state.profile?.weight ? { lbs: +state.profile.weight, date: null, source: "profile" } : null);
}
function logBodyweight(lbs, date = todayISO()) {
  const v = parseNum(lbs); if (!(v > 0)) return false;
  state.bodyweight = state.bodyweight || [];
  const i = state.bodyweight.findIndex(e => e.date === date);
  const entry = { date, lbs: Math.round(v * 10) / 10, source: "manual", updatedAt: Date.now() };
  if (i >= 0) state.bodyweight[i] = entry; else state.bodyweight.push(entry);
  state.bodyweight.sort((x, y) => x.date.localeCompare(y.date));
  state.profile.weight = entry.lbs;   // keep BMI / TDEE current
  saveState();
  return true;
}
// Effective load for a bodyweight-type set on a date: body weight + added
function effectiveLoad(set, date) {
  const bw = bodyweightOn(date);
  return (bw ? bw.lbs : 0) + parseNum(set?.load);
}

// Sleep score — Apple's published watchOS formula, recomputed from the same
// HealthKit stage data Apple uses: duration 50 pts, bedtime consistency 30 pts,
// interruptions 20 pts. Apple does NOT expose its own score to apps (verified
// against the iOS 26.2 SDK), so this is the closest legitimate reconstruction;
// expect it to track the Health app within a few points, not match exactly.
function sleepScoreFor(date) {
  const d = state.health?.daily?.[date];
  const hours = d?.sleepHours;
  if (!Number.isFinite(+hours) || hours <= 0) return null;

  // Duration — 50 pts, full credit at 7.5 h
  const durationPts = 50 * Math.min(1, hours / 7.5);

  // Interruptions — 20 pts, drained by time awake inside the night block
  let interruptPts;
  if (d.sleepAwakeMin != null) {
    interruptPts = 20 * Math.max(0, 1 - d.sleepAwakeMin / 60);
  } else {
    interruptPts = 16;                          // no stage detail → neutral 80%
  }

  // Bedtime consistency — 30 pts vs the median onset of the prior 14 nights
  let consistencyPts = 24;                      // neutral until a baseline exists
  if (d.sleepOnsetMin != null) {
    const prior = [];
    for (let i = 1; i <= 14; i++) {
      const dd = new Date(date + "T00:00:00"); dd.setDate(dd.getDate() - i);
      const p = state.health?.daily?.[isoDateLocal(dd)];
      if (p?.sleepOnsetMin != null) prior.push(p.sleepOnsetMin);
    }
    if (prior.length >= 3) {
      prior.sort((x, y) => x - y);
      const med = prior[Math.floor(prior.length / 2)];
      let diff = Math.abs(d.sleepOnsetMin - med);
      diff = Math.min(diff, 1440 - diff);       // clock wrap
      consistencyPts = diff <= 20 ? 30 : 30 * Math.max(0, 1 - (diff - 20) / 130);
    }
  }
  return Math.round(durationPts + interruptPts + consistencyPts);
}

// ── Step streak ───────────────────────────────────────────────────────────
// A day is "hit" when health.daily[date].stepsToday >= settings.stepGoal.
// The streak counts consecutive hit days ending yesterday; today extends it
// live once hit, but an unfinished today never breaks it.
function stepsFor(date) {
  const v = state.health?.daily?.[date]?.stepsToday;
  return Number.isFinite(+v) ? +v : null;
}
// Apple Health undercounts Jacob's steps (measured: 7k reported ≈ 10k real).
// Raw HealthKit values stay stored untouched; the factor applies at read time,
// so changing it recalibrates all history instantly.
function stepCalibration() {
  const a = +state.settings.stepCalApple, b = +state.settings.stepCalActual;
  if (a > 0 && b > 0) return Math.min(3, Math.max(0.5, b / a));
  return 1;
}
function calSteps(raw) {
  return raw == null ? null : Math.round(raw * stepCalibration());
}
// Weekly workout goal: completed sessions (with logged data) in the current
// Monday-start week.
// A session only counts toward the weekly goal if it was real work: at least
// 4 logged sets, or any cardio (a ride or a walk counts however few "sets" it
// records). Everything still shows in History and Progress — this gate is only
// about the weekly workout target.
const WEEKLY_MIN_SETS = 4;
function countsTowardWeeklyGoal(w) {
  if (!w) return false;
  let sets = 0;
  for (const e of w.entries || []) {
    const logged = (e.sets || []).filter(setHasData);
    if (!logged.length) continue;
    if (exerciseType(state.exercises.find(x => x.id === e.exerciseId)) === "cardio") return true;
    sets += logged.length;
  }
  return sets >= WEEKLY_MIN_SETS;
}
function workoutsThisWeek() {
  const now = new Date(todayISO() + "T00:00:00");
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const start = isoDateLocal(mon);
  return state.workouts.filter(w =>
    w.id !== activeWorkoutId && w.date >= start && w.date <= todayISO() &&
    countsTowardWeeklyGoal(w)).length;
}

// Streak milestone ladder — mirrored in StreakWidget.swift
function streakTier(streak) {
  if (streak <= 0) return { emoji: "·", label: "", weeks: 0, milestone: false };
  const w = Math.floor(streak / 7);
  if (w === 0) return { emoji: "🔥", label: "", weeks: 0, milestone: false };
  const emoji = w >= 8 ? "🐐" : ["⚡", "🌟", "💎", "👑", "👑", "🏆", "🏆"][w - 1];
  const label = w >= 4 && w < 6 ? "1 MONTH+" : `WEEK ${w}`;
  return { emoji, label, weeks: w, milestone: streak % 7 === 0 };
}
function streakInfo() {
  const goal = state.settings.stepGoal || 10000;
  const today = todayISO();
  const todaySteps = calSteps(stepsFor(today) ?? (healthDataIsFromToday() ? (state.health?.data?.stepsToday ?? null) : null));
  const days = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(today + "T00:00:00"); d.setDate(d.getDate() - i);
    const iso = isoDateLocal(d);
    const steps = iso === today ? todaySteps : calSteps(stepsFor(iso));
    days.push({ date: iso, steps, hit: steps != null && steps >= goal, known: steps != null });
  }
  let streak = 0;
  for (let i = 1; i < days.length; i++) {         // start yesterday
    if (days[i].hit) streak++;
    else break;
  }
  const todayHit = days[0].hit;
  const streakBase = streak;          // completed days before today
  if (todayHit) streak++;
  const last14 = days.slice(0, 14).reverse();
  const wk = workoutsThisWeek();
  const wkGoal = state.settings.workoutGoalPerWeek || 3;
  return { goal, streak, streakBase, todayHit, todaySteps: todaySteps ?? 0, last14, pct: Math.min(1, (todaySteps || 0) / goal),
           workouts: wk, workoutGoal: wkGoal, weekHit: wk >= wkGoal };
}

// Push the streak snapshot to the native side (widget + notifications). No-op on web.
function syncStreakToNative() {
  const bridge = window.Capacitor?.Plugins?.StreakBridge;
  if (!bridge) return;
  const s = streakInfo();
  bridge.update({
    date: todayISO(),
    stepsToday: Math.round(s.todaySteps), goal: s.goal, streak: s.streak, streakBase: s.streakBase, todayHit: s.todayHit,
    last7: s.last14.slice(-7).map(d => ({ date: d.date, hit: d.hit, known: d.known })),
    reminderEnabled: !!state.settings.stepReminder,
    reminderHour: state.settings.stepReminderHour || 19,
    calibration: stepCalibration(),
    workoutsThisWeek: s.workouts, workoutGoal: s.workoutGoal, weekHit: s.weekHit,
    updatedAt: Date.now(),
  }).catch(() => {});
}

function attachDailyContext(w) {
  const h = healthFor(w.date);
  if (!h) return;
  w.health = w.health || {};
  if (h.sleepHours != null && w.health.sleepHours == null) {
    w.health.sleepHours = h.sleepHours;
    const sc = sleepScoreFor(w.date);
    if (sc != null) w.health.sleepScore = sc;
  }
  if (h.stepsToday != null && w.health.steps == null) w.health.steps = h.stepsToday;
}

function proteinGoalFor(p) {
  const g = state.profile?.goals?.protein;
  if (g) return g;
  return p?.weight ? Math.round(p.weight * 0.8) : null;   // 0.8 g/lb default
}
function calorieGoalFor(p) {
  const g = state.profile?.goals?.calories;
  if (g) return g;
  const t = calcTDEE(p);
  return t ? Math.round(t) : null;
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
  Object.assign(n, patch, { updatedAt: Date.now() });
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
let lastSavedAt = null;

// Persist to localStorage and schedule a cloud push. This is the ONLY path
// that should stamp modification times: local edits bump state.lastModified
// and the active workout's updatedAt so the merge engine can tell which side
// of a conflict is newer.
function saveState() {
  try {
    const now = Date.now();
    state.lastModified = now;
    if (activeWorkoutId) {
      const w = state.workouts.find(x => x.id === activeWorkoutId);
      if (w) w.updatedAt = now;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    lastSavedAt = now;
    updateSavedIndicator();
    window.WorkoutSync?.scheduleCloudPush?.();   // no-op when signed out
  } catch (e) {
    console.error("saveState failed", e);
    const ind = document.getElementById("saved-indicator");
    if (ind) { ind.textContent = "⚠ Save failed"; ind.className = "saved-indicator failed"; }
  }
}
// Persist without claiming a local modification or pushing — used when we've
// adopted cloud state verbatim, or flushed on background with nothing new.
function saveStateLocalOnly() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// Sync status (fed by firebase-sync.js) drives the saved indicator + banner.
let syncStatus = { online: typeof navigator !== "undefined" ? navigator.onLine !== false : true, pendingPush: false, lastPushAt: 0, signedIn: false };
function updateSavedIndicator() {
  const ind = document.getElementById("saved-indicator");
  if (ind && lastSavedAt) {
    const sec = Math.floor((Date.now() - lastSavedAt) / 1000);
    const ago = sec < 5 ? "" : sec < 60 ? ` ${sec}s ago` : sec < 3600 ? ` ${Math.floor(sec/60)}m ago` : ` ${Math.floor(sec/3600)}h ago`;
    ind.className = "saved-indicator";
    if (!syncStatus.online) { ind.textContent = `✓ Saved on device${ago} · offline`; ind.classList.add("offline"); }
    else if (syncStatus.signedIn && syncStatus.pendingPush) { ind.textContent = `✓ Saved${ago} · syncing…`; }
    else if (syncStatus.signedIn) { ind.textContent = `✓ Saved & synced${ago}`; }
    else { ind.textContent = `✓ Saved on device${ago}`; }
  }
  const banner = document.getElementById("net-banner");
  if (banner) banner.classList.toggle("hidden", syncStatus.online);
  if (activeWorkoutId) renderDuration(getWorkout(activeWorkoutId));
}
setInterval(updateSavedIndicator, 5000);

/* ───────── Merge engine ─────────
   Cloud state never blindly replaces local state. Collections merge by id with
   per-item updatedAt; deletions are carried as tombstones so a deleted workout
   can't be resurrected by a device that was offline; scalar sections fall back
   to whichever side saved more recently. Deterministic and idempotent, so two
   devices converge after one exchange and stop (no ping-pong pushes). */
function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
function stateFingerprint(s) {
  const c = { ...s }; delete c.lastModified; return stableStringify(c);
}
function unionById(a = [], b = [], preferA) {
  const out = new Map();
  for (const item of b || []) if (item && item.id) out.set(item.id, item);
  for (const item of a || []) {
    if (!item || !item.id) continue;
    const other = out.get(item.id);
    if (!other) { out.set(item.id, item); continue; }
    const ta = item.updatedAt || 0, tb = other.updatedAt || 0;
    out.set(item.id, ta === tb ? (preferA ? item : other) : (ta > tb ? item : other));
  }
  return Array.from(out.values());
}
function mergeStates(local, remote) {
  if (!remote) return local;
  if (!local) return remote;
  const localNewer = (local.lastModified || 0) >= (remote.lastModified || 0);
  const newer = localNewer ? local : remote;
  const out = { ...newer };

  // Tombstones: union, keep the latest deletion time per id
  const tomb = {};
  for (const src of [remote.deletedWorkouts || {}, local.deletedWorkouts || {}])
    for (const [id, ts] of Object.entries(src)) tomb[id] = Math.max(tomb[id] || 0, ts || 0);
  out.deletedWorkouts = tomb;

  // Workouts: union by id, newer updatedAt wins, drop anything deleted after its last edit
  out.workouts = unionById(local.workouts, remote.workouts, localNewer)
    .filter(w => !(tomb[w.id] && tomb[w.id] >= (w.updatedAt || 0)))
    .sort((a, b) => (a.date + (a.createdAt || 0)).localeCompare(b.date + (b.createdAt || 0)));

  // Exercises are displayed name-sorted, so a canonical order here costs nothing
  // and makes the merge order-independent. Templates keep their user-defined
  // order: the remote's sequence first, then anything only local has.
  out.exercises = unionById(local.exercises, remote.exercises, localNewer)
    .sort((a, b) => (a.name || "").localeCompare(b.name || "") || String(a.id).localeCompare(String(b.id)));
  out.templates = unionById(local.templates, remote.templates, localNewer);

  // Nutrition: keyed by date
  const nut = new Map();
  for (const src of localNewer ? [remote.nutrition, local.nutrition] : [local.nutrition, remote.nutrition])
    for (const n of src || []) {
      const prev = nut.get(n.date);
      if (!prev || (n.updatedAt || 0) >= (prev.updatedAt || 0)) nut.set(n.date, n);
    }
  out.nutrition = Array.from(nut.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Body-weight log: keyed by date, newer edit wins
  const bwMap = new Map();
  for (const src of localNewer ? [remote.bodyweight, local.bodyweight] : [local.bodyweight, remote.bodyweight])
    for (const e of src || []) { const prev = bwMap.get(e.date); if (!prev || (e.updatedAt || 0) >= (prev.updatedAt || 0)) bwMap.set(e.date, e); }
  out.bodyweight = Array.from(bwMap.values()).sort((x, y) => x.date.localeCompare(y.date));

  // Health: latest snapshot wins; daily history unions by date
  const lh = local.health || {}, rh = remote.health || {};
  const lt = Date.parse(lh.data?.updatedAt || 0) || 0, rt = Date.parse(rh.data?.updatedAt || 0) || 0;
  const daily = { ...(rh.daily || {}) };
  for (const [d, v] of Object.entries(lh.daily || {})) {
    daily[d] = (v.updatedAt || 0) >= (daily[d]?.updatedAt || 0) ? { ...(daily[d] || {}), ...v } : { ...v, ...daily[d] };
  }
  out.health = { ...(lt >= rt ? lh : rh), daily };

  // Everything else (settings, profile, days, flags) comes from `newer` via the spread.
  out.lastModified = Math.max(local.lastModified || 0, remote.lastModified || 0);
  return out;
}
// Canonical forms for exercise identity. The key is punctuation-blind and
// singularizes each word, so "Pull-Ups", "Pull ups" and "Pull Up" all match —
// while staying conservative enough that "Row Machine" ≠ "Rowing Machine (Erg)".
const exNameKey = (name) => String(name || "")
  .trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .split(/\s+/).filter(Boolean)
  .map(w => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) ? w.slice(0, -1) : w)
  .join(" ");
const exSlugId = (name) => "x-" + exNameKey(name).replace(/[^a-z0-9]+/g, "-");

// Same-movement names that normalization alone can't connect. Keyed by
// exNameKey(alias) → canonical display name. Reviewed against Jacob's real
// library (Aug 2026); look-alikes that are genuinely different movements
// (Chest Press Machine vs Seated CPM, Barbell vs Dumbbell Shrug, pushdown
// attachments, assisted vs free pull-ups) are deliberately NOT aliased.
const EXERCISE_ALIASES = {
  [exNameKey("Calf Raises")]: { name: "Standing Calf Raise" },
  [exNameKey("Treadmill 9 Incline")]: { name: "Incline Walk", type: "cardio" },
  [exNameKey("Barbell Shoulder Press")]: { name: "Overhead Military Press" },
  [exNameKey("Standing Chest Press")]: { name: "Chest Press Machine" },
};
const resolveExerciseName = (name) => EXERCISE_ALIASES[exNameKey(name)]?.name || name;
const exGroupKey = (name) => exNameKey(resolveExerciseName(name));

// Self-healing exercise dedupe. Historic bug: every device seeded its library
// with RANDOM ids, so after a two-device merge the same name existed twice and
// workout history split across the ids — "Lat Pulldown" showed no Prev even
// with months of sessions. Group by normalized name, keep the most-referenced
// id, relink every workout, and fold the duplicates' fields into the survivor.
// Runs inside migrate() (i.e., on every load and every cloud merge) and is
// idempotent, so devices converge no matter which order they sync in.
function dedupeExercises(s) {
  const refs = {};
  for (const w of s.workouts || [])
    for (const e of w.entries || []) refs[e.exerciseId] = (refs[e.exerciseId] || 0) + 1;

  const groups = new Map();
  for (const ex of s.exercises || []) {
    const k = exGroupKey(ex.name);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(ex);
  }

  const idMap = {};
  const nameMap = {};   // old display name → canonical display name (for templates)
  const keep = [];
  for (const [, list] of groups) {
    if (list.length === 1) {
      const solo = list[0];
      const meta = EXERCISE_ALIASES[exNameKey(solo.name)];
      if (meta && meta.name !== solo.name) {
        nameMap[solo.name] = meta.name;
        solo.name = meta.name;
        if (meta.type) solo.type = meta.type;
      }
      keep.push(solo);
      continue;
    }
    list.sort((x, y) =>
      (refs[y.id] || 0) - (refs[x.id] || 0) ||                       // most history wins
      (String(y.id).startsWith("x-") - String(x.id).startsWith("x-")) || // then deterministic ids
      String(x.id).localeCompare(String(y.id)));
    const canon = list[0];
    const canonMeta = EXERCISE_ALIASES[exNameKey(canon.name)];
    if (canonMeta && canonMeta.name !== canon.name) { nameMap[canon.name] = canonMeta.name; canon.name = canonMeta.name; }
    if (canonMeta?.type) canon.type = canonMeta.type;
    for (const dupe of list.slice(1)) {
      idMap[dupe.id] = canon.id;
      if (dupe.name !== canon.name) nameMap[dupe.name] = canon.name;
      // Fold anything useful the duplicate knew that the survivor doesn't
      if ((!canon.type || canon.type === "strength") && dupe.type && dupe.type !== "strength") canon.type = dupe.type;
      if (!canon.defaultRepRange && dupe.defaultRepRange) canon.defaultRepRange = dupe.defaultRepRange;
      canon.days = Array.from(new Set([...(canon.days || []), ...(dupe.days || [])]));
    }
    keep.push(canon);
  }

  if (Object.keys(idMap).length) s.exercises = keep;
  if (Object.keys(idMap).length || Object.keys(nameMap).length) {
    for (const w of s.workouts || []) {
      let touched = false;
      for (const e of w.entries || []) {
        if (idMap[e.exerciseId]) { e.exerciseId = idMap[e.exerciseId]; touched = true; }
      }
      if (touched) w.updatedAt = Date.now();
    }
    // Templates and day lists reference exercises BY NAME — follow the merge,
    // and de-dupe in case a template listed both spellings.
    for (const t of s.templates || []) {
      const seen = new Set();
      t.exercises = (t.exercises || [])
        .map(n => nameMap[n] || n)
        .filter(n => { const k = exGroupKey(n); if (seen.has(k)) return false; seen.add(k); return true; });
    }
    for (const day of Object.keys(s.days || {})) {
      const seen = new Set();
      s.days[day] = (s.days[day] || [])
        .map(n => nameMap[n] || n)
        .filter(n => { const k = exGroupKey(n); if (seen.has(k)) return false; seen.add(k); return true; });
    }
  }
  return s;
}

function defaultProfile() {
  return { height: 70, weight: 175, age: 28, sex: "male", activity: "moderate", goals: { calories: null, protein: null } };
}
function defaultState() {
  // Fresh installs are EMPTY (no seed workouts, no fake PRs). The user's real
  // data only arrives via Firebase cloud sync after they sign in. Defaults —
  // exercise library, templates, profile — are shared across everyone since
  // they're just starting points, not personal data.
  return {
    schemaVersion: 1,
    exercises: SEED.exercises.map(e => ({ id: exSlugId(e.name), ...e })),
    days: JSON.parse(JSON.stringify(SEED.days)),
    templates: JSON.parse(JSON.stringify(DEFAULT_TEMPLATES)),
    workouts: [],
    settings: { units: "lbs", theme: "dark", gistId: "" },
    profile: defaultProfile(),
    nutrition: [],
    health: { lastFetch: null, data: null, lastError: null, daily: {} },
    bodyweight: [],
    deletedWorkouts: {},
    lastModified: 0,
    seedHistoryLoaded: true, // suppress migrate() from ever loading synthetic data
  };
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
  s.settings.stepGoal ??= 10000;
  s.settings.stepReminder ??= false;
  s.settings.stepReminderHour ??= 19;   // 7 pm local
  s.settings.stepCalApple ??= null;     // "Apple Health says X…"
  s.settings.stepCalActual ??= null;    // "…but I actually walked Y" → factor Y/X
  s.settings.workoutGoalPerWeek ??= 4;
  s.profile = Object.assign(defaultProfile(), s.profile || {});
  s.profile.goals = Object.assign({ calories: null, protein: null }, s.profile.goals || {});
  s.nutrition ??= [];
  s.health ??= { lastFetch: null, data: null, lastError: null };
  s.health.daily ??= {};
  s.bodyweight ??= [];
  s.deletedWorkouts ??= {};
  s.lastModified ??= 0;
  s.seedHistoryLoaded ??= false;
  // Per-entry notes + per-workout health are optional; normalise old shapes
  s.workouts.forEach(w => { w.updatedAt ??= w.createdAt || 0; });
  // Seed templates if missing (first run after this feature shipped)
  if (!s.templates) s.templates = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  // Migrate old object-keyed templates → array shape
  if (s.templates && !Array.isArray(s.templates)) {
    s.templates = Object.entries(s.templates).map(([name, t]) => ({
      id: uid(),
      name,
      subtitle: t.subtitle || "",
      exercises: t.exercises || [],
    }));
  }

  // v1 → v2 template refresh: if a template still contains the EXACT original
  // v1 default exercise list, replace it with the v2 defaults (Jacob's actual
  // current routine). Untouched-only — customized templates are left alone.
  if (!s.templatesV2Applied) {
    s.templates = s.templates.map(t => {
      const v1 = V1_DEFAULT_TEMPLATE_EXERCISES[t.name];
      if (!v1) return t;
      const same = t.exercises.length === v1.length &&
        t.exercises.every((ex, i) => ex === v1[i]);
      if (!same) return t;
      const v2 = DEFAULT_TEMPLATES.find(x => x.name === t.name);
      if (!v2) return t;
      return { ...t, exercises: [...v2.exercises], subtitle: v2.subtitle };
    });
    s.templatesV2Applied = true;
  }

  // Add any default templates that don't already exist by id (e.g. Cardio added later)
  DEFAULT_TEMPLATES.forEach(def => {
    if (!s.templates.find(t => t.id === def.id)) {
      s.templates.push(JSON.parse(JSON.stringify(def)));
    }
  });

  // Default type on any legacy exercise entry
  s.exercises.forEach(e => { if (!e.type) e.type = "strength"; });

  // Sync any new seed exercises into existing state (idempotent, name-matched)
  SEED.exercises.forEach(seedEx => {
    if (!s.exercises.find(e => exGroupKey(e.name) === exGroupKey(seedEx.name))) {
      s.exercises.push({ id: exSlugId(seedEx.name), type: "strength", ...seedEx });
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

  dedupeExercises(s);

  // One-time template refresh: rebuild each split from the exercises the user
  // ACTUALLY does — top 4 by session count within workouts carrying that
  // template's label (ties → most recently done, then total sets). Runs only
  // once there's real signal (≥8 completed workouts, ≥3 sessions per label) so
  // an empty install can never blank the templates; pads from the existing
  // template when history has fewer than 4 distinct exercises.
  if (!s.templatesTopFourApplied) {
    const completed = (s.workouts || []).filter(w => w.entries?.some(e => e.sets?.some(setHasData)));
    if (completed.length >= 8) {
      const byId = Object.fromEntries((s.exercises || []).map(e => [e.id, e]));
      for (const t of s.templates || []) {
        const sessions = completed.filter(w => (w.day || "") === t.name);
        if (sessions.length < 3) continue;
        const stats = new Map();
        for (const w of sessions) for (const e of w.entries || []) {
          if (!e.sets?.some(setHasData)) continue;
          const st = stats.get(e.exerciseId) || { count: 0, last: "", sets: 0 };
          st.count++; if (w.date > st.last) st.last = w.date;
          st.sets += e.sets.filter(setHasData).length;
          stats.set(e.exerciseId, st);
        }
        const isCardioTpl = exNameKey(t.name) === "cardio";
        const ranked = Array.from(stats.entries())
          .map(([id, st]) => ({ ex: byId[id], ...st }))
          .filter(r => r.ex)
          .filter(r => isCardioTpl ? exerciseType(r.ex) === "cardio" : exerciseType(r.ex) !== "cardio")
          .sort((x, y) => y.count - x.count || y.last.localeCompare(x.last) || y.sets - x.sets);
        if (!ranked.length) continue;
        const names = ranked.slice(0, 4).map(r => r.ex.name);
        for (const n of t.exercises || []) {
          if (names.length >= 4) break;
          if (!names.some(x => exGroupKey(x) === exGroupKey(n))) names.push(n);
        }
        if (JSON.stringify(names) !== JSON.stringify(t.exercises)) { t.exercises = names; t.updatedAt = Date.now(); }
      }
      s.templatesTopFourApplied = true;
    }
  }

  // Riding program (Sep 2026): two riding templates + the daily finisher, and a
  // weekly workout goal of 4. Added by id so a later rename/edit is never undone.
  if (!s.templatesRiderAdded) {
    for (const t of DEFAULT_TEMPLATES) {
      if (!["tpl-rider-core", "tpl-rider-legs"].includes(t.id)) continue;
      if (!s.templates.some(x => x.id === t.id || exNameKey(x.name) === exNameKey(t.name))) {
        s.templates.push(JSON.parse(JSON.stringify(t)));
      }
    }
    s.settings.workoutGoalPerWeek = 4;
    s.templatesRiderAdded = true;
  }

  // Sep 5: the finisher is part of the two riding days, not its own template,
  // and Cardio is just the walk.
  if (!s.templatesRiderV2) {
    s.templates = s.templates.filter(t => t.id !== "tpl-finisher");
    const legs = s.templates.find(t => t.id === "tpl-rider-legs");
    if (legs) {
      for (const n of ["Two-Point Hold", "Wall Sit"]) {
        if (!legs.exercises.some(x => exGroupKey(x) === exGroupKey(n))) legs.exercises.push(n);
      }
    }
    const cardio = s.templates.find(t => t.id === "tpl-cardio");
    if (cardio) { cardio.exercises = ["Incline Walk"]; cardio.subtitle = "Walk"; }
    s.templatesRiderV2 = true;
  }

  // Jacob's dictated template edits (Aug 26): Pull swaps the pushdown for Cable
  // Face Pull; Push adds Decline; Mix drops Hammer Curl + the mislabeled
  // "Standing Chest Press" in favor of Chest Press Machine + his top ab machine.
  // Explicit lists (not diffs) so it lands identically no matter what each
  // device's top-four pass computed. Runs once, after the top-four block.
  if (s.templatesTopFourApplied && !s.templatesUserEditAug2026) {
    const setT = (name, list) => {
      const t = (s.templates || []).find(x => x.name === name);
      if (t) { t.exercises = list; t.updatedAt = Date.now(); }
    };
    setT("Push", ["Bench Press", "Decline Chest Press - Barbell", "Overhead Military Press", "Dumbbell Side Lateral Raise", "Tricep Cable Pushdown"]);
    setT("Pull", ["Preacher Curl", "Row Machine", "Lat Pulldown", "Cable Face Pull"]);
    setT("Mix",  ["Row Machine", "Preacher Curl", "Chest Press Machine", "Arms UP AB Machine"]);
    s.templatesUserEditAug2026 = true;
  }

  // Add startTime/endTime to any workouts that predate the schema change
  s.workouts.forEach(w => {
    w.startTime ??= "";
    w.endTime ??= "";
  });

  // Seed history is disabled — new users see empty state until they sign in
  // and pull their real data from Firebase. seedHistoryLoaded is force-set so
  // this branch never runs regardless of what an old export contains.
  s.seedHistoryLoaded = true;

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
lastSavedAt = Date.now();   // whatever we loaded is already on disk

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
  if (name === "templates") renderTemplates();
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
  state.templates.forEach(t => {
    const preview = t.exercises.slice(0, 3).join(" · ") + (t.exercises.length > 3 ? `  +${t.exercises.length - 3}` : "");
    tiles.push(`
      <button class="template-tile" data-template="${escapeHtml(t.id)}" style="--hue:${hueFor(t.name)}">
        <div class="tile-name">${escapeHtml(t.name)} <span class="tile-count">${t.exercises.length}</span></div>
        <div class="tile-sub">${escapeHtml(t.subtitle || "")}</div>
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

function startNewWorkout(templateId = "") {
  const tpl = templateId ? state.templates.find(t => t.id === templateId) : null;
  const w = {
    id: uid(),
    date: todayISO(),
    day: tpl ? tpl.name : "",
    startTime: nowHHMM(),
    endTime: "",
    notes: "",
    entries: [],
    createdAt: Date.now(),
  };
  state.workouts.push(w);
  activeWorkoutId = w.id;
  if (tpl) {
    tpl.exercises.forEach(name => {
      const ex = findOrCreateExercise(name);
      addEntry(ex.id);
    });
  }
  saveState();
  resetInactivityTimer();
  renderToday();
}

function findOrCreateExercise(name) {
  const norm = exGroupKey(name);
  let ex = state.exercises.find(e => exGroupKey(e.name) === norm);
  if (!ex) {
    ex = { id: uid(), name: String(name).trim(), defaultSets: 3, defaultRepRange: "", days: [], updatedAt: Date.now() };
    state.exercises.push(ex);
  }
  return ex;
}

function addEntry(exerciseId) {
  const w = getWorkout(activeWorkoutId);
  if (!w) return;
  const ex = state.exercises.find(e => e.id === exerciseId);
  const type = exerciseType(ex);
  const n = type === "cardio" ? 1 : (ex?.defaultSets ?? 3);
  const sets = [];
  for (let i = 0; i < n; i++) sets.push(blankSet(type));
  w.entries.push({ exerciseId, sets, note: "" });
  saveState();
}

// Record a deletion so a device that was offline can't bring the workout back on merge.
function deleteWorkout(id) {
  state.workouts = state.workouts.filter(w => w.id !== id);
  state.deletedWorkouts = state.deletedWorkouts || {};
  state.deletedWorkouts[id] = Date.now();
  if (activeWorkoutId === id) activeWorkoutId = null;
  saveState();
}

function discardWorkout() {
  if (!activeWorkoutId) return;
  if (!confirm("Discard this workout? Nothing will be saved.")) return;
  deleteWorkout(activeWorkoutId);
  renderToday();
  toast("Workout discarded");
}

// Drop empty trailing sets (keep at least one per entry) before a workout is closed out.
function trimEmptySets(w) {
  w.entries.forEach(e => { e.sets = e.sets.filter((s, i) => i === 0 || setHasData(s)); });
}
function workoutHasData(w) {
  return w.entries.some(e => e.sets.some(setHasData));
}

// Finalize current workout silently — used by end-time auto-save and the inactivity timer.
function autoFinalize(toastMsg = "Workout saved") {
  const w = getWorkout(activeWorkoutId);
  if (!w) return;
  trimEmptySets(w);
  attachDailyContext(w);
  saveState();
  const finishedId = activeWorkoutId;
  activeWorkoutId = null;
  clearInactivityTimer();
  renderToday();
  toast(toastMsg);
  attachWatchData(finishedId, { silent: false });
}

// Native only: pull heart-rate / calories / the Watch's own workout record for
// the workout's start→end window and store it on the workout. No-op on the web.
async function attachWatchData(workoutId, { silent = true } = {}) {
  const api = window.WorkoutNativeHealth;
  if (!api?.isNative || !api.enrichWorkout) return null;
  const w = getWorkout(workoutId);
  if (!w || !w.startTime || !w.endTime) return null;
  try {
    const h = await api.enrichWorkout({ date: w.date, startTime: w.startTime, endTime: w.endTime });
    if (!h) { if (!silent) toast("No Watch data found for that window"); return null; }
    w.health = h;
    w.updatedAt = Date.now();
    saveState();
    if (!silent) {
      const bits = [];
      if (h.avgHR) bits.push(`avg ${h.avgHR} bpm`);
      if (h.maxHR) bits.push(`max ${h.maxHR}`);
      if (h.activeKcal) bits.push(`${fmt(h.activeKcal)} kcal`);
      toast(bits.length ? `Watch: ${bits.join(" · ")}` : "Watch data attached");
    }
    if (document.querySelector("#view-history.active")) renderHistory();
    return h;
  } catch (e) {
    console.warn("[watch] enrich failed:", e?.message || e);
    if (!silent) toast("Couldn't read Watch data");
    return null;
  }
}

// Inactivity auto-save: if a workout is open and nothing happens for 1 hour, finalize it.
let inactivityTimer = null;
const INACTIVITY_MS = 60 * 60 * 1000;
function resetInactivityTimer() {
  clearInactivityTimer();
  if (!activeWorkoutId) return;
  inactivityTimer = setTimeout(() => {
    const w = getWorkout(activeWorkoutId);
    if (!w) return;
    if (!workoutHasData(w)) return; // don't auto-save an empty workout
    if (!w.endTime) w.endTime = nowHHMM();
    autoFinalize("Auto-saved after 1 hour idle");
  }, INACTIVITY_MS);
}
function clearInactivityTimer() {
  if (inactivityTimer) { clearTimeout(inactivityTimer); inactivityTimer = null; }
}

function finishWorkout() {
  const w = getWorkout(activeWorkoutId);
  if (!w) return;
  // Auto-fill end time if user didn't manually set it
  if (!w.endTime) w.endTime = nowHHMM();
  trimEmptySets(w);
  attachDailyContext(w);
  if (!workoutHasData(w)) {
    if (!confirm("This workout has no logged sets. Save anyway?")) return;
  }
  saveState();
  const finishedId = activeWorkoutId;
  activeWorkoutId = null;
  clearInactivityTimer();
  renderToday();
  toast("Workout saved");
  showView("history");
  attachWatchData(finishedId, { silent: false });
}

// Duration readout: fixed once ended, live (elapsed since start) while in progress.
function renderDuration(w) {
  const el = $("#workout-duration");
  if (!el || !w) return;
  if (w.startTime && !w.endTime) {
    const mins = durationMinutes(w.startTime, nowHHMM());
    el.textContent = mins > 0 ? `${durationLabel(w.startTime, nowHHMM())} · live` : "Just started";
    el.classList.add("live");
  } else {
    el.textContent = durationLabel(w.startTime, w.endTime);
    el.classList.remove("live");
  }
}

function renderToday() {
  $("#today-date").textContent = new Date().toLocaleDateString(undefined,
    {weekday:"long", month:"long", day:"numeric"});

  const w = ensureActiveWorkout();
  if (!w) {
    $("#active-workout").classList.add("hidden");
    $("#no-workout").classList.remove("hidden");
    return;
  }
  $("#no-workout").classList.add("hidden");
  $("#active-workout").classList.remove("hidden");

  $("#active-workout-label").textContent = w.day ? w.day : "Workout";
  $("#workout-date").value = w.date;
  $("#workout-start").value = w.startTime || "";
  $("#workout-end").value = w.endTime || "";
  $("#workout-notes").value = w.notes || "";
  renderDuration(w);

  const entries = $("#entries");
  entries.innerHTML = "";
  w.entries.forEach((entry, i) => entries.appendChild(renderEntry(entry, i)));
}

function renderEntry(entry, idx) {
  const ex = state.exercises.find(e => e.id === entry.exerciseId);
  if (!ex) return document.createElement("div");
  const w = getWorkout(activeWorkoutId);

  // Most recent previous session that logged this exercise — for the "Prev" column
  const prevSession = state.workouts
    .filter(x => x.id !== w.id && x.entries.some(e => e.exerciseId === ex.id))
    .sort((a,b) => b.date.localeCompare(a.date))[0];
  const prevSets = prevSession?.entries.find(e => e.exerciseId === ex.id)?.sets ?? [];

  const type = exerciseType(ex);
  normalizeEntrySets(entry, type);
  const div = type === "cardio"
    ? renderCardioEntry(entry, idx, ex, prevSets, w)
    : renderSetEntry(entry, idx, ex, prevSets, w, type);

  // Per-exercise note (plain text, saved with the workout)
  const noteWrap = document.createElement("div");
  noteWrap.className = "entry-note";
  noteWrap.innerHTML = `<input type="text" class="inp-note" placeholder="Note" value="${escapeHtml(entry.note || "")}" autocapitalize="sentences">`;
  noteWrap.querySelector(".inp-note").addEventListener("input", e => { entry.note = e.target.value; saveState(); });
  div.appendChild(noteWrap);
  return div;
}

// Column layout per set-based type. Cardio has its own renderer.
const SET_COLUMNS = {
  strength:   () => [{ key: "load", label: state.settings.units, step: "0.5", mode: "decimal" }, { key: "reps", label: "Reps", step: "1", mode: "numeric" }],
  bodyweight: () => [{ key: "reps", label: "Reps", step: "1", mode: "numeric" }, { key: "load", label: `+${state.settings.units}`, step: "2.5", mode: "decimal", placeholder: "+0" }],
  timed:      () => [{ key: "seconds", label: "Sec", step: "1", mode: "numeric" }],
};
function prevLabel(type, s) {
  if (!s || !setHasData(s)) return "—";
  if (type === "strength")   return `${parseNum(s.load)}×${parseNum(s.reps)}`;
  if (type === "bodyweight") return `${parseNum(s.reps)}${parseNum(s.load) ? `+${parseNum(s.load)}` : ""}`;
  if (type === "timed")      return `${parseNum(s.seconds)}s`;
  return "—";
}

function renderSetEntry(entry, idx, ex, prevSets, w, type) {
  const div = document.createElement("div");
  div.className = `entry entry-${type}`;
  div.dataset.idx = idx;
  const cols = SET_COLUMNS[type]();

  const setRows = entry.sets.map((s, si) => `
      <tr>
        <td class="set-num">${si+1}</td>
        ${cols.map(c => `<td><input class="inp-set" data-key="${c.key}" type="number" inputmode="${c.mode}" step="${c.step}" min="0" value="${s[c.key] ?? ""}" placeholder="${c.placeholder || c.label}"></td>`).join("")}
        <td class="col-prev">${prevLabel(type, prevSets[si])}</td>
        <td class="col-actions"><button class="icon-btn danger btn-remove-set" aria-label="Remove set">×</button></td>
      </tr>`).join("");

  const sub = [`${ex.defaultSets || entry.sets.length} sets`, ex.defaultRepRange].filter(Boolean).join(" · ");
  const typeTag = type === "strength" ? "" : `<span class="type-tag ${type}">${EXERCISE_TYPES[type].label}</span>`;
  const stats = type === "strength"
    ? `<span>Vol <strong class="stat-vol">0</strong></span><span>e1RM <strong class="stat-1rm">0</strong></span>`
    : type === "bodyweight"
      ? `<span>Reps <strong class="stat-total">0</strong></span><span class="stat-bw"></span>`
      : `<span>Total <strong class="stat-total">0s</strong></span>`;

  div.innerHTML = `
    <div class="entry-head">
      <div>
        <div class="entry-name">${escapeHtml(ex.name)}${typeTag}</div>
        <div class="entry-sub">${escapeHtml(sub)}</div>
      </div>
      <div class="entry-actions">
        <button class="icon-btn btn-edit-exercise" aria-label="Edit exercise" title="Type, sets, rep range">${ICON.edit}</button>
        <button class="icon-btn btn-add-set" aria-label="Add set">+</button>
        <button class="icon-btn danger btn-remove-entry" aria-label="Remove exercise">${ICON.trash}</button>
      </div>
    </div>
    <table class="sets-table">
      <thead><tr><th>#</th>${cols.map(c => `<th>${c.label}</th>`).join("")}<th>Prev</th><th></th></tr></thead>
      <tbody>${setRows}</tbody>
    </table>
    <div class="entry-footer"><div class="entry-stats">${stats}<span class="stat-delta"></span></div></div>
  `;

  div.querySelector(".btn-edit-exercise").onclick = () => openExerciseEditor(ex.id, renderToday);
  div.querySelector(".btn-add-set").onclick = () => { entry.sets.push(blankSet(type)); saveState(); renderToday(); };
  div.querySelector(".btn-remove-entry").onclick = () => { w.entries.splice(idx, 1); saveState(); renderToday(); };
  div.querySelectorAll(".btn-remove-set").forEach((btn, si) => {
    btn.onclick = () => {
      entry.sets.splice(si, 1);
      if (entry.sets.length === 0) entry.sets.push(blankSet(type));
      saveState(); renderToday();
    };
  });
  div.querySelectorAll("tbody tr").forEach((tr, si) => {
    tr.querySelectorAll(".inp-set").forEach(inp => {
      inp.addEventListener("input", () => { entry.sets[si][inp.dataset.key] = inp.value; saveState(); updateEntryStats(div, entry, prevSets, type); });
    });
  });

  updateEntryStats(div, entry, prevSets, type);
  return div;
}

function renderCardioEntry(entry, idx, ex, prevSets, w) {
  const div = document.createElement("div");
  div.className = "entry entry-cardio";
  div.dataset.idx = idx;
  if (entry.sets.length === 0) entry.sets.push(blankSet("cardio"));

  const prevBits = [];
  const pd = prevSets.reduce((a, s) => a + parseNum(s.duration), 0);
  const pm = prevSets.reduce((a, s) => a + parseNum(s.distance), 0);
  if (pd) prevBits.push(`${fmt(pd)} min`);
  if (pm) prevBits.push(`${fmt(pm, 1)} mi`);
  const prevLabelText = prevBits.length ? `Last time: ${prevBits.join(" · ")}` : "";

  const rows = entry.sets.map((s, si) => `
      <div class="cardio-row" data-si="${si}">
        <div class="cardio-row-num">${entry.sets.length > 1 ? si + 1 : ""}</div>
        <label><span class="label">Min</span><input class="inp-cardio" data-key="duration" type="number" inputmode="decimal" step="1" min="0" value="${s.duration ?? ""}" placeholder="min"></label>
        <label><span class="label">Miles</span><input class="inp-cardio" data-key="distance" type="number" inputmode="decimal" step="0.1" min="0" value="${s.distance ?? ""}" placeholder="mi"></label>
        <label><span class="label">Avg HR</span><input class="inp-cardio" data-key="avgHR" type="number" inputmode="numeric" step="1" min="0" value="${s.avgHR ?? ""}" placeholder="bpm"></label>
        <button class="icon-btn danger btn-remove-set" aria-label="Remove interval">×</button>
      </div>`).join("");

  div.innerHTML = `
    <div class="entry-head">
      <div>
        <div class="entry-name">${escapeHtml(ex.name)}<span class="type-tag cardio">Cardio</span></div>
        <div class="entry-sub">${escapeHtml(prevLabelText)}</div>
      </div>
      <div class="entry-actions">
        <button class="icon-btn btn-edit-exercise" aria-label="Edit exercise">${ICON.edit}</button>
        <button class="icon-btn btn-add-set" aria-label="Add interval" title="Add interval">+</button>
        <button class="icon-btn danger btn-remove-entry" aria-label="Remove exercise">${ICON.trash}</button>
      </div>
    </div>
    <div class="cardio-rows">${rows}</div>
    <div class="entry-footer">
      <div class="entry-stats">
        <span>Total <strong class="stat-cardio-total">—</strong></span>
        <span class="stat-cardio-pace"></span>
        <span class="stat-delta"></span>
      </div>
    </div>
  `;

  div.querySelector(".btn-edit-exercise").onclick = () => openExerciseEditor(ex.id, renderToday);
  div.querySelector(".btn-add-set").onclick = () => { entry.sets.push(blankSet("cardio")); saveState(); renderToday(); };
  div.querySelector(".btn-remove-entry").onclick = () => { w.entries.splice(idx, 1); saveState(); renderToday(); };
  div.querySelectorAll(".btn-remove-set").forEach((btn, si) => {
    btn.onclick = () => {
      entry.sets.splice(si, 1);
      if (entry.sets.length === 0) entry.sets.push(blankSet("cardio"));
      saveState(); renderToday();
    };
  });
  div.querySelectorAll(".cardio-row").forEach((row, si) => {
    row.querySelectorAll(".inp-cardio").forEach(inp => {
      inp.addEventListener("input", () => { entry.sets[si][inp.dataset.key] = inp.value; saveState(); updateCardioStats(div, entry, prevSets); });
    });
  });

  updateCardioStats(div, entry, prevSets);
  return div;
}

function updateCardioStats(div, entry, prevSets) {
  const dur = entry.sets.reduce((a, s) => a + parseNum(s.duration), 0);
  const dist = entry.sets.reduce((a, s) => a + parseNum(s.distance), 0);
  const bits = [];
  if (dur) bits.push(`${fmt(dur)} min`);
  if (dist) bits.push(`${fmt(dist, 1)} mi`);
  div.querySelector(".stat-cardio-total").textContent = bits.length ? bits.join(" · ") : "—";
  const paceEl = div.querySelector(".stat-cardio-pace");
  if (dur > 0 && dist > 0) {
    const paceMin = dur / dist, m = Math.floor(paceMin), s = Math.round((paceMin - m) * 60);
    paceEl.innerHTML = `Pace <strong>${m}:${String(s).padStart(2,"0")}/mi</strong>`;
  } else paceEl.textContent = "";
  const delta = div.querySelector(".stat-delta");
  const prevDur = prevSets.reduce((a, s) => a + parseNum(s.duration), 0);
  if (prevDur > 0 && dur > 0) {
    const diff = dur - prevDur;
    if (Math.abs(diff) < 0.5) delta.textContent = "= same";
    else if (diff > 0) delta.innerHTML = `<span class="delta-up">▲ +${fmt(diff)} min</span>`;
    else delta.innerHTML = `<span class="delta-down">▼ ${fmt(diff)} min</span>`;
  } else delta.textContent = "";
}

function updateEntryStats(div, entry, prevSets, type = "strength") {
  const delta = div.querySelector(".stat-delta");
  const showDelta = (cur, prev, unit = "") => {
    if (!(prev > 0 && cur > 0)) { delta.textContent = ""; return; }
    const diff = cur - prev;
    if (Math.abs(diff) < 0.001) delta.textContent = "= same";
    else if (diff > 0) delta.innerHTML = `<span class="delta-up">▲ +${fmt(diff)}${unit}</span>`;
    else delta.innerHTML = `<span class="delta-down">▼ ${fmt(diff)}${unit}</span>`;
  };
  if (type === "bodyweight") {
    const w = getWorkout(activeWorkoutId);
    const date = w?.date || todayISO();
    const bw = bodyweightOn(date);
    const cur = entry.sets.reduce((a, s) => a + parseNum(s.reps), 0);
    const prev = prevSets.reduce((a, s) => a + parseNum(s.reps), 0);
    const topAdded = Math.max(0, ...entry.sets.map(s => parseNum(s.load)));
    let best = 0;
    entry.sets.forEach(s => { if (setHasData(s)) best = Math.max(best, oneRM(effectiveLoad(s, date), parseNum(s.reps))); });
    div.querySelector(".stat-total").textContent = fmt(cur) + (topAdded ? ` · +${topAdded}` : "");
    const bwEl = div.querySelector(".stat-bw");
    if (bwEl) bwEl.innerHTML = bw
      ? `<button class="bw-chip" title="Tap to log today's body weight">BW <strong>${fmt(bw.lbs, 1)}</strong>${bw.source === "profile" ? "<em>profile</em>" : ""}</button> · total <strong>${fmt((bw.lbs + topAdded))}</strong>${best ? ` · e1RM <strong>${fmt(best)}</strong>` : ""}`
      : `<button class="bw-chip">Set body weight</button>`;
    const chip = div.querySelector(".bw-chip");
    if (chip) chip.onclick = () => {
      const v = prompt(`Body weight on ${prettyDate(date)} (${state.settings.units})`, bw ? String(bw.lbs) : "");
      if (v != null && logBodyweight(v, date)) { toast("Body weight logged"); renderToday(); }
    };
    showDelta(cur, prev, " reps"); return;
  }
  if (type === "timed") {
    const cur = entry.sets.reduce((a, s) => a + parseNum(s.seconds), 0);
    const prev = prevSets.reduce((a, s) => a + parseNum(s.seconds), 0);
    div.querySelector(".stat-total").textContent = `${fmt(cur)}s`;
    showDelta(cur, prev, "s"); return;
  }
  let vol = 0, best1rm = 0;
  entry.sets.forEach(s => {
    vol += setVolume(s.load, s.reps);
    const r = oneRM(parseNum(s.load), parseNum(s.reps));
    if (r > best1rm) best1rm = r;
  });
  const prevVol = prevSets.reduce((a, s) => a + setVolume(s.load, s.reps), 0);
  div.querySelector(".stat-vol").textContent = fmt(vol);
  div.querySelector(".stat-1rm").textContent = fmt(best1rm, 1);
  showDelta(vol, prevVol);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ───────── Exercise picker ───────── */
function openPicker(onPick) {
  const modal = $("#picker-modal");
  const list = $("#picker-list");
  const search = $("#picker-search");
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
    // Offer to create when there's no exact match — with a type choice
    const exact = state.exercises.some(e => e.name.toLowerCase() === q);
    const createRow = $("#picker-create-row");
    if (q && !exact) {
      createRow.classList.remove("hidden");
      $("#picker-create-name").textContent = search.value.trim();
    } else {
      createRow.classList.add("hidden");
    }
  }
  $$("#picker-create-row .type-choice").forEach(btn => {
    btn.onclick = () => {
      const type = btn.dataset.type;
      const ex = { id: uid(), name: search.value.trim(), type, defaultSets: type === "cardio" ? 1 : 3, defaultRepRange: "", days: [], updatedAt: Date.now() };
      state.exercises.push(ex);
      saveState();
      onPick(ex.id);
      closePicker();
    };
  });
  search.oninput = renderList;
  renderList();
  modal.classList.remove("hidden");
  setTimeout(() => search.focus(), 100);
}
function closePicker() { $("#picker-modal").classList.add("hidden"); }

/* ───────── History view ───────── */
// Human-readable set summary for a history row, per exercise type.
function setsSummary(type, sets, date) {
  const logged = sets.filter(setHasData);
  if (!logged.length) return "";
  switch (type) {
    case "cardio": {
      const dur = logged.reduce((a, s) => a + parseNum(s.duration), 0);
      const dist = logged.reduce((a, s) => a + parseNum(s.distance), 0);
      const hr = logged.map(s => parseNum(s.avgHR)).filter(Boolean);
      const bits = [];
      if (dur) bits.push(`${fmt(dur)} min`);
      if (dist) bits.push(`${fmt(dist, 1)} mi`);
      if (hr.length) bits.push(`${Math.round(hr.reduce((a, b) => a + b, 0) / hr.length)} bpm`);
      if (logged.length > 1) bits.push(`${logged.length} intervals`);
      return bits.join(" · ");
    }
    case "timed":      return logged.map(s => `${parseNum(s.seconds)}s`).join("  ·  ");
    case "bodyweight": {
      const bw = date ? bodyweightOn(date) : null;
      return logged.map(s => `${parseNum(s.reps)}${parseNum(s.load) ? `+${parseNum(s.load)}` : ""}`).join("  ·  ") + " reps" + (bw ? ` @ BW ${fmt(bw.lbs, 0)}` : "");
    }
    default:           return logged.map(s => `${parseNum(s.load)}×${parseNum(s.reps)}`).join("  ·  ");
  }
}

// "traditionalStrengthTraining" → "Traditional Strength Training"
function humanizeWorkoutType(t) {
  if (!t) return "Workout";
  return String(t).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, ch => ch.toUpperCase());
}

// Template → accent hue so cards are visually scannable (stable per name).
function hueFor(name) {
  const fixed = { push: 214, pull: 268, legs: 152, mix: 32, cardio: 6 };
  const k = String(name || "").trim().toLowerCase();
  if (fixed[k] != null) return fixed[k];
  let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function renderHistory() {
  const list = $("#history-list");
  const filter = $("#history-filter");

  if (filter.options.length < 2) {
    state.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.id; opt.textContent = e.name;
      filter.appendChild(opt);
    });
    filter.onchange = renderHistory;
  }

  const filterId = filter.value;
  const items = state.workouts
    .filter(w => w.id !== activeWorkoutId)
    .filter(w => !filterId || w.entries.some(e => e.exerciseId === filterId))
    .sort((a,b) => (b.date + (b.createdAt || 0)).localeCompare(a.date + (a.createdAt || 0)));

  if (items.length === 0) {
    list.innerHTML = `<div class="empty-card"><div class="empty-art">${ICON.clock}</div><h2>No workouts yet</h2><p>Start one from the Today tab. It'll show up here with volume, time, and Watch data.</p></div>`;
    return;
  }

  const native = isNativeApp();
  list.innerHTML = items.map(w => {
    const s = workoutStats(w);
    const detail = w.entries.map(e => {
      const ex = state.exercises.find(x => x.id === e.exerciseId);
      const type = exerciseType(ex);
      const txt = setsSummary(type, e.sets, w.date);
      return `<div class="history-exercise">
        <div class="history-exercise-name">${escapeHtml(ex?.name || "Unknown")}${type !== "strength" ? `<span class="type-tag ${type}">${EXERCISE_TYPES[type].label}</span>` : ""}</div>
        <div class="history-sets">${escapeHtml(txt) || "(no sets)"}</div>
        ${e.note ? `<div class="history-note">${escapeHtml(e.note)}</div>` : ""}
      </div>`;
    }).join("");

    const timeBits = [];
    if (w.startTime && w.endTime) timeBits.push(`${w.startTime}–${w.endTime} · ${durationLabel(w.startTime, w.endTime)}`);
    else if (w.startTime) timeBits.push(`started ${w.startTime}`);
    const sleepH = w.health?.sleepHours ?? healthFor(w.date)?.sleepHours;
    const sleepSc = w.health?.sleepScore ?? sleepScoreFor(w.date);
    if (sleepH != null) timeBits.push(`☾ ${(+sleepH).toFixed(1)}h${sleepSc != null ? ` · ${sleepSc}` : ""}`);
    const subLine = [w.day, ...timeBits].filter(Boolean).map(escapeHtml).join("  ·  ");

    const stats = [];
    if (s.volume) stats.push(`<span>Volume <strong>${fmt(s.volume)}</strong> ${state.settings.units}</span>`);
    if (s.sets) stats.push(`<span>Sets <strong>${s.sets}</strong></span>`);
    if (s.cardioMin) stats.push(`<span>Cardio <strong>${fmt(s.cardioMin)}</strong> min${s.cardioMi ? ` · <strong>${fmt(s.cardioMi,1)}</strong> mi` : ""}</span>`);
    stats.push(`<span>Exercises <strong>${w.entries.length}</strong></span>`);

    const h = w.health;
    const watchLine = h ? `<div class="history-watch">
        ${ICON.watch}
        ${h.avgHR ? `<span class="hr">${ICON.heart} <strong>${h.avgHR}</strong> avg${h.maxHR ? ` · <strong>${h.maxHR}</strong> max` : ""}</span>` : ""}
        ${h.activeKcal ? `<span class="kcal">${ICON.flame} <strong>${fmt(h.activeKcal)}</strong> kcal</span>` : ""}
        ${h.hkWorkout ? `<span class="muted">${escapeHtml(humanizeWorkoutType(h.hkWorkout.type))}${h.hkWorkout.durationMin ? ` · ${h.hkWorkout.durationMin} min` : ""} on Watch</span>` : ""}
      </div>` : "";
    const watchBtn = native && w.startTime && w.endTime
      ? `<button class="btn btn-ghost small btn-pull-watch">${ICON.watch} ${h ? "Refresh Watch data" : "Pull Watch data"}</button>` : "";

    return `
      <div class="history-item" data-id="${w.id}" style="--hue:${hueFor(w.day)}">
        <div class="history-item-head">
          <div>
            <div class="history-item-date">${prettyDate(w.date)}</div>
            <div class="history-item-day">${subLine}</div>
          </div>
          <div class="history-item-actions">
            <button class="icon-btn btn-edit-workout" aria-label="Edit">${ICON.edit}</button>
            <button class="icon-btn danger btn-del-workout" aria-label="Delete">${ICON.trash}</button>
          </div>
        </div>
        <div class="history-item-stats">${stats.join("")}</div>
        ${watchLine}
        ${w.notes ? `<div class="history-notes">${escapeHtml(w.notes)}</div>` : ""}
        <div class="history-detail">${detail}${watchBtn}</div>
      </div>`;
  }).join("");

  list.querySelectorAll(".history-item").forEach(el => {
    el.onclick = (e) => {
      if (e.target.closest("button")) return;
      el.classList.toggle("open");
    };
    el.querySelector(".btn-edit-workout").onclick = (e) => {
      e.stopPropagation();
      activeWorkoutId = el.dataset.id;
      resetInactivityTimer();
      showView("today");
    };
    el.querySelector(".btn-del-workout").onclick = (e) => {
      e.stopPropagation();
      if (!confirm("Delete this workout?")) return;
      deleteWorkout(el.dataset.id);
      renderHistory();
      toast("Deleted");
    };
    const pull = el.querySelector(".btn-pull-watch");
    if (pull) pull.onclick = async (e) => {
      e.stopPropagation();
      pull.disabled = true; pull.textContent = "Reading Watch…";
      await attachWatchData(el.dataset.id, { silent: false });
      pull.disabled = false;
      renderHistory();
      list.querySelector(`.history-item[data-id="${el.dataset.id}"]`)?.classList.add("open");
    };
  });
}

/* ───────── Progress view ───────── */
let chartExerciseVolume, chartExercise1rm;
let splitCharts = [];
let progressSeg = "overview";

function renderProgress() {
  const ex = $("#progress-exercise");
  if (ex.options.length === 0) {
    state.exercises.slice().sort((a,b)=>a.name.localeCompare(b.name)).forEach(e => {
      const opt = document.createElement("option"); opt.value = e.id; opt.textContent = e.name;
      ex.appendChild(opt);
    });
    ex.onchange = () => renderExerciseCharts(ex.value);
  }
  $$("#progress-seg button").forEach(b => {
    b.classList.toggle("active", b.dataset.seg === progressSeg);
    b.onclick = () => { progressSeg = b.dataset.seg; renderProgress(); };
  });
  $$(".seg-panel").forEach(p => p.classList.toggle("hidden", p.id !== `seg-${progressSeg}`));

  if (progressSeg === "overview") { renderThisWeekTiles(); renderSessionCompare(); renderSplitCharts(); renderConsistency(); }
  if (progressSeg === "exercises") { renderProgression(); renderExerciseCharts(ex.value || ex.options[0]?.value); }
  if (progressSeg === "records")   { renderPRTimeline(); renderPRList(); }
  if (progressSeg === "insights")  { renderInsights(); }
}

// Shared per-workout aggregate (used by History, week tiles, analytics)
function workoutStats(w) {
  let volume = 0, sets = 0, best1rm = 0, cardioMin = 0, cardioMi = 0, timedSec = 0, bwReps = 0;
  w.entries.forEach(e => {
    const ex = state.exercises.find(x => x.id === e.exerciseId);
    const type = exerciseType(ex);
    e.sets.forEach(s => {
      if (!setHasData(s)) return;
      switch (type) {
        case "cardio": cardioMin += parseNum(s.duration); cardioMi += parseNum(s.distance); break;
        case "timed": timedSec += parseNum(s.seconds); sets++; break;
        case "bodyweight": bwReps += parseNum(s.reps); sets++; break;
        default: {
          const v = setVolume(s.load, s.reps);
          if (v > 0) { volume += v; sets++; }
          const r = oneRM(parseNum(s.load), parseNum(s.reps));
          if (r > best1rm) best1rm = r;
        }
      }
    });
  });
  return { volume, sets, best1rm, cardioMin, cardioMi, timedSec, bwReps, durationMin: cardioMin };
}

const pct = (x) => x == null ? "—" : `${Math.round(x * 100)}%`;
const statusIcon = (s) => s === "up" ? `<span class="st up">▲</span>` : s === "down" ? `<span class="st down">▼</span>` : s === "first" ? `<span class="st first">new</span>` : `<span class="st flat">=</span>`;

function renderThisWeekTiles() {
  const wrap = $("#this-week-tiles"); if (!wrap) return;
  const now = Analytics.weekSummary(0), past = Analytics.weekSummary(-1);
  const tile = (label, value, unit, cur, prev, precision = 0, opts = {}) => {
    let delta = "";
    if (prev != null && prev > 0 && cur != null) {
      const diff = cur - prev;
      const cls = diff > 0 ? "up" : diff < 0 ? "down" : "";
      delta = `<div class="tile-delta ${cls}">${diff > 0 ? "+" : ""}${opts.pct ? Math.round(diff * 100) + " pts" : fmt(diff, precision)} vs last wk</div>`;
    } else if (opts.sub) delta = `<div class="tile-delta muted">${opts.sub}</div>`;
    return `<div class="week-tile ${opts.cls || ""}"><div class="tile-label">${label}</div><div class="tile-value">${value}<span class="tile-unit">${unit}</span></div>${delta}</div>`;
  };
  wrap.innerHTML =
    tile("Overload", now.score == null ? "—" : Math.round(now.score * 100), now.score == null ? "" : "%", now.score, past.score, 0, { pct: true, sub: `${now.improved}/${now.compared} lifts improved`, cls: "hero" }) +
    tile("PRs", now.prs, "", now.prs, past.prs, 0, { sub: "new records", cls: now.prs ? "hero-pr" : "" }) +
    tile("Workouts", now.workouts, "", now.workouts, past.workouts) +
    tile("Sets", now.sets, "", now.sets, past.sets) +
    tile("Time", (now.minutes/60).toFixed(1), " hr", now.minutes/60, past.minutes/60, 1) +
    tile("Cardio", fmt(now.cardioMin), " min", now.cardioMin, past.cardioMin);
  const r = now.range, a = new Date(r.start + "T00:00:00"), b = new Date(r.end + "T00:00:00"); b.setDate(b.getDate() - 1);
  const f = d => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  $("#this-week-range").textContent = `${f(a)} – ${f(b)}`;
}

function renderSessionCompare() {
  const el = $("#session-compare"); if (!el) return;
  const { sessions } = Analytics.replay();
  const recent = sessions.slice(-6).reverse();
  if (!recent.length) { el.innerHTML = `<div class="muted small">No completed sessions yet.</div>`; return; }
  el.innerHTML = recent.map(s => {
    const w = s.workout;
    const head = s.compared
      ? `<strong>${s.improved}/${s.compared}</strong> improved${s.regressed ? ` · <span class="down">${s.regressed} down</span>` : ""}${s.prs ? ` · <span class="pr">${s.prs} PR${s.prs > 1 ? "s" : ""}</span>` : ""}`
      : `<span class="muted">first time for these exercises</span>`;
    const rows = s.items.map(it => {
      // Lead with the most meaningful PR (e1RM > load > reps > volume), fold the rest into "+N"
      const order = { e1rm: 0, load: 1, reps: 2, seconds: 2, distance: 2, pace: 2, volume: 3 };
      const prs = it.prs.slice().sort((x, y) => (order[x.kind] ?? 9) - (order[y.kind] ?? 9));
      const note = prs.length ? prLabel(prs[0]) + (prs.length > 1 ? ` +${prs.length - 1}` : "") : (it.notes[0] || (it.status === "first" ? "baseline" : it.status === "flat" ? "same as last time" : ""));
      return `<div class="cmp-row"><span class="cmp-name">${statusIcon(it.status)}<span>${escapeHtml(it.name)}</span></span><span class="cmp-note ${prs.length ? "pr" : ""}">${escapeHtml(note)}</span></div>`;
    }).join("");
    return `<details class="session-cmp" style="--hue:${hueFor(w.day)}">
      <summary><div><div class="cmp-title">${escapeHtml(w.day || "Workout")} <span class="muted">· ${prettyDate(w.date)}</span></div><div class="cmp-head">${head}</div></div>
        <div class="cmp-bar"><div style="width:${s.score == null ? 0 : Math.round(s.score * 100)}%"></div></div></summary>
      <div class="cmp-rows">${rows}</div></details>`;
  }).join("");
}

function prLabel(p) {
  const u = state.settings.units;
  switch (p.kind) {
    case "e1rm": return `${p.bw ? "e1RM PR (BW+added) " : "e1RM PR "}${Math.round(p.value)} ${u}`;
    case "load": return `heaviest ${p.value} ${u}`;
    case "reps":
      if (p.total) return `${p.value} total reps PR`;
      if (p.bw) return p.load ? `rep PR ${p.value} × +${p.load} ${u}` : `rep PR ${p.value} (bodyweight)`;
      return `rep PR ${p.value}×${p.load} ${u}`;
    case "volume": return `volume PR ${fmt(p.value)}`;
    case "seconds": return `${p.value}s PR`;
    case "distance": return `${p.value.toFixed(1)} mi PR`;
    case "pace": { const m = Math.floor(p.value), s = Math.round((p.value - m) * 60); return `pace PR ${m}:${String(s).padStart(2,"0")}/mi`; }
    default: return `${p.kind} PR`;
  }
}

function renderSplitCharts() {
  const host = $("#split-charts"); if (!host) return;
  splitCharts.forEach(c => c.destroy()); splitCharts = [];
  const { labels, series } = Analytics.volumeBySplit(8);
  const names = Object.keys(series).filter(k => series[k].some(v => v > 0));
  if (!names.length) { host.innerHTML = `<div class="muted small">Log a few weeks and each split gets its own chart here.</div>`; return; }
  host.innerHTML = names.map(n => `<div class="split-chart"><div class="split-name"><i style="background:hsl(${hueFor(n)} 85% 62%)"></i>${escapeHtml(n)}</div><div class="split-canvas"><canvas data-split="${escapeHtml(n)}"></canvas></div></div>`).join("");
  const c = chartBase();
  host.querySelectorAll("canvas").forEach(cv => {
    const n = cv.dataset.split; const color = `hsl(${hueFor(n)} 85% 62% / 0.85)`;
    splitCharts.push(new Chart(cv, {
      type: "bar",
      data: { labels, datasets: [{ data: series[n].map(Math.round), backgroundColor: color, borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: c.elev, titleColor: c.text, bodyColor: c.text } },
        scales: { x: { ticks: { color: c.dim, font: { size: 10 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 4 }, grid: { display: false }, border: { display: false } },
                  y: { display: false, beginAtZero: true } } },
    }));
  });
}

function renderConsistency() {
  const el = $("#consistency"); if (!el) return;
  const c = Analytics.consistency();
  const splits = Object.entries(c.bySplit).sort((a, b) => b[1] - a[1]);
  el.innerHTML = `
    <div class="consistency-row">
      <div class="metric"><div class="metric-label">Last 4 weeks</div><div class="metric-value">${c.total}</div><div class="metric-delta">${c.perWeek.toFixed(1)} / week</div></div>
      <div class="metric"><div class="metric-label">Week streak</div><div class="metric-value">${c.streak}</div><div class="metric-delta">${c.streak ? "weeks in a row" : "log this week to start"}</div></div>
    </div>
    <div class="split-pills">${splits.map(([n, k]) => `<span class="split-pill" style="--hue:${hueFor(n)}"><i></i>${escapeHtml(n)} <strong>${k}</strong></span>`).join("") || `<span class="muted small">No sessions in the last 4 weeks.</span>`}</div>`;
}

function renderProgression() {
  const el = $("#progression-list"); if (!el) return;
  const rows = Analytics.progression();
  if (!rows.length) { el.innerHTML = `<div class="muted small">Needs at least two sessions of an exercise.</div>`; return; }
  const u = state.settings.units;
  const fmtMetric = (r, v) => (r.metric === "e1rm" || r.metric === "effE1rm") ? `${Math.round(v)} ${u}` : r.metric === "reps" ? `${v} reps` : r.metric === "seconds" ? `${v}s` : `${(+v).toFixed(1)} mi`;
  el.innerHTML = rows.map(r => `
    <div class="prog-row" data-ex="${r.exerciseId}">
      <div class="prog-main"><span class="st ${r.trend}">${r.trend === "up" ? "▲" : r.trend === "down" ? "▼" : "="}</span><span class="prog-name">${escapeHtml(r.name)}</span></div>
      <div class="prog-vals"><span class="prog-now">${fmtMetric(r, r.now)}</span><span class="prog-delta ${r.pct > 0.005 ? "up" : r.pct < -0.005 ? "down" : ""}">${r.pct > 0.005 ? "+" : ""}${Math.abs(r.pct) > 0.99 ? (r.pct > 0 ? "99%+" : "−99%") : Math.round(r.pct * 100) + "%"}</span></div>
      <div class="prog-sub muted small">${r.recentSessions} session${r.recentSessions === 1 ? "" : "s"} in 4 wks · ${r.ups} up · ${r.downs} down</div>
    </div>`).join("");
  el.querySelectorAll(".prog-row").forEach(row => row.onclick = () => { $("#progress-exercise").value = row.dataset.ex; renderExerciseCharts(row.dataset.ex); $("#progress-exercise").scrollIntoView({ behavior: "smooth", block: "start" }); });
}

function getWeekData() {
  // Per-exercise weekly aggregates (strength only) for the detail charts
  const map = {};
  state.workouts.filter(w => w.id !== activeWorkoutId).forEach(w => {
    const iw = isoWeek(w.date);
    if (!map[iw.key]) map[iw.key] = { weekKey: iw.key, label: iw.label, perExercise: {} };
    w.entries.forEach(e => {
      const isBW = exerciseType(state.exercises.find(x => x.id === e.exerciseId)) === "bodyweight";
      e.sets.forEach(s => {
        const load = isBW ? effectiveLoad(s, w.date) : parseNum(s.load);
        const v = load * parseNum(s.reps);
        const r = oneRM(load, parseNum(s.reps));
        if (v <= 0 && r <= 0) return;
        const slot = map[iw.key].perExercise[e.exerciseId] ||= { volume: 0, sets: 0, best1rm: 0 };
        slot.volume += v; if (setHasData(s)) slot.sets += 1; if (r > slot.best1rm) slot.best1rm = r;
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
    bg: css.getPropertyValue("--bg-elev").trim() || "#12161c",
    elev: css.getPropertyValue("--bg-elev-3").trim() || "#222a34",
  };
};

function makeLineChart(canvas, labels, datasets) {
  const c = chartBase();
  return new Chart(canvas, {
    type: "line",
    data: { labels, datasets: datasets.map(d => ({
      tension: 0.3,
      borderColor: d.color || c.accent,
      backgroundColor: (d.color || c.accent) + "22",
      pointBackgroundColor: c.bg,
      pointBorderColor: d.color || c.accent,
      pointBorderWidth: 2,
      pointRadius: 3.5,
      pointHoverRadius: 6,
      pointHitRadius: 14,
      borderWidth: 2,
      fill: true,
      ...d,
    })) },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: datasets.length > 1, labels: { color: c.text } },
        tooltip: {
          backgroundColor: c.elev, titleColor: c.text, bodyColor: c.text, borderColor: c.grid, borderWidth: 1,
          padding: 10, cornerRadius: 10, displayColors: false,
        },
      },
      scales: {
        x: { ticks: { color: c.dim, maxRotation: 0, autoSkip: true, maxTicksLimit: 7, font: { size: 11 } }, grid: { display: false }, border: { display: false } },
        y: { ticks: { color: c.dim, font: { size: 11 }, maxTicksLimit: 5 }, grid: { color: c.grid }, border: { display: false }, beginAtZero: true },
      },
    },
  });
}


function renderExerciseCharts(exId) {
  if (chartExerciseVolume) chartExerciseVolume.destroy();
  if (chartExercise1rm) chartExercise1rm.destroy();
  const metrics = $("#progress-metrics"); metrics.innerHTML = "";
  const table = $("#exercise-sessions"); if (table) table.innerHTML = "";
  if (!exId) return;
  const ex = state.exercises.find(e => e.id === exId);
  const type = exerciseType(ex);
  const hist = Analytics.exerciseHistory(exId, 8);
  const u = state.settings.units;

  if (!hist.length) { metrics.innerHTML = `<div class="muted small">No sessions logged for this exercise yet.</div>`; return; }
  const cur = hist[0], prev = hist[1];
  const card = (label, value, delta, unit = "") => {
    const cls = delta > 0 ? "up" : delta < 0 ? "down" : "";
    const d = delta != null && Number.isFinite(delta) && Math.abs(delta) > 0.001 ? `<div class="metric-delta ${cls}">${delta > 0 ? "+" : ""}${fmt(delta, 1)}${unit} vs last</div>` : `<div class="metric-delta">${prev ? "same as last" : "first session"}</div>`;
    return `<div class="metric"><div class="metric-label">${label}</div><div class="metric-value">${value}</div>${d}</div>`;
  };
  if (type === "strength") {
    metrics.innerHTML = [
      card(`Best e1RM (${u})`, fmt(cur.e1rm, 1), prev ? cur.e1rm - prev.e1rm : null),
      card("Top set", `${cur.topLoad}×${cur.repsAtTop}`, prev && cur.topLoad === prev.topLoad ? cur.repsAtTop - prev.repsAtTop : (prev ? cur.topLoad - prev.topLoad : null), prev && cur.topLoad === prev.topLoad ? " reps" : ` ${u}`),
      card("Volume", fmt(cur.volume), prev ? cur.volume - prev.volume : null),
    ].join("");
  } else if (type === "cardio") {
    metrics.innerHTML = [card("Distance", `${cur.distance.toFixed(1)} mi`, prev ? cur.distance - prev.distance : null, " mi"), card("Minutes", fmt(cur.duration), prev ? cur.duration - prev.duration : null, " min"), card("Avg HR", cur.avgHR ? Math.round(cur.avgHR) : "—", null)].join("");
  } else if (type === "bodyweight") {
    metrics.innerHTML = [
      card(`Effective e1RM (${u})`, cur.effE1rm ? fmt(cur.effE1rm) : "—", prev && prev.effE1rm ? cur.effE1rm - prev.effE1rm : null),
      card("Top set", `${cur.repsAtTop}${cur.topLoad ? ` +${cur.topLoad}` : ""} @ BW ${fmt(cur.bw || 0)}`, prev && prev.bw ? (cur.bw || 0) - prev.bw : null, ` ${u} BW`),
      card("Rel. strength", cur.relStrength ? `${cur.relStrength.toFixed(2)}× BW` : "—", prev && prev.relStrength ? cur.relStrength - prev.relStrength : null, "×"),
    ].join("");
  } else {
    const k = type === "timed" ? "seconds" : "reps";
    metrics.innerHTML = [card(type === "timed" ? "Total seconds" : "Total reps", cur[k], prev ? cur[k] - prev[k] : null), card("Best set", cur.bestSet, prev ? cur.bestSet - prev.bestSet : null), card("Sets", cur.sets, null)].join("");
  }

  // Charts (strength + bodyweight — weekly best e1RM and volume; bodyweight uses BW + added)
  if (type === "strength" || type === "bodyweight") {
    const data = getWeekData();
    const points = data.map(d => ({ label: d.label, volume: d.perExercise[exId]?.volume || 0, best1rm: d.perExercise[exId]?.best1rm || 0 })).filter(p => p.volume > 0 || p.best1rm > 0);
    if (points.length) {
      chartExercise1rm = makeLineChart($("#chart-exercise-1rm"), points.map(p => p.label), [{ label: "Estimated 1RM", data: points.map(p => +p.best1rm.toFixed(1)) }]);
      chartExerciseVolume = makeLineChart($("#chart-exercise-volume"), points.map(p => p.label), [{ label: "Weekly volume", data: points.map(p => Math.round(p.volume)), color: chartBase().dim }]);
    }
  }

  // Session table
  if (table) {
    const line = (h) => type === "strength" ? `${h.topLoad}×${h.repsAtTop} · e1RM ${Math.round(h.e1rm)} · vol ${fmt(h.volume)}`
      : type === "cardio" ? `${fmt(h.duration)} min · ${h.distance.toFixed(1)} mi${h.avgHR ? ` · ${Math.round(h.avgHR)} bpm` : ""}`
      : type === "timed" ? `${h.seconds}s total · best ${h.bestSet}s`
      : `${h.reps} reps${h.topLoad ? ` · +${h.topLoad}` : ""} @ BW ${fmt(h.bw || 0)}${h.effE1rm ? ` · e1RM ${fmt(h.effE1rm)}` : ""}`;
    table.innerHTML = `<div class="health-group-title" style="margin-top:14px">Last ${hist.length} sessions</div>` + hist.map(h => `
      <div class="sess-row"><div><div class="sess-date">${prettyDate(h.date)} <span class="muted">· ${escapeHtml(h.day || "")}</span></div><div class="sess-line">${line(h)}</div></div>
      <div class="sess-status">${statusIcon(h.status)}${h.prs.length ? `<span class="pr-badge">PR</span>` : ""}</div></div>`).join("");
  }
}

function renderPRTimeline() {
  const el = $("#pr-timeline"); if (!el) return;
  const prs = Analytics.recentPRs(20);
  if (!prs.length) { el.innerHTML = `<div class="muted small">PRs appear here once an exercise beats its earlier sessions.</div>`; return; }
  let lastDate = "";
  el.innerHTML = prs.map(p => {
    const dateHead = p.date !== lastDate ? `<div class="pr-date">${prettyDate(p.date)}</div>` : "";
    lastDate = p.date;
    return `${dateHead}<div class="pr-event"><span class="pr-kind ${p.kind}">${p.kind === "e1rm" ? "1RM" : p.kind}</span><span class="pr-ex">${escapeHtml(p.name)}</span><span class="pr-val">${escapeHtml(prLabel(p).replace(/^(e1RM PR|heaviest|rep PR|volume PR|pace PR)\s*/, ""))}${p.prevValue ? `<em>was ${p.kind === "volume" ? fmt(p.prevValue) : p.kind === "pace" ? "" : Math.round(p.prevValue)}</em>` : ""}</span></div>`;
  }).join("");
}

function renderPRList() {
  const list = $("#pr-list"); if (!list) return;
  const rows = Analytics.recordsTable().filter(r => r.prs.e1rm || r.prs.load || r.prs.reps);
  if (!rows.length) { list.innerHTML = `<div class="muted small">Log a few strength sets to see records.</div>`; return; }
  const u = state.settings.units;
  list.innerHTML = rows.map(r => `
    <div class="pr-row">
      <div class="pr-name">${escapeHtml(r.name)}</div>
      <div class="pr-detail">${[
        r.prs.load ? `heaviest ${r.prs.load.value} ${u}` : null,
        r.prs.reps ? `rep PR ${r.prs.reps.value}×${r.prs.reps.load}` : null,
        r.last ? `last PR ${prettyDate(r.last)}` : null,
      ].filter(Boolean).join(" · ")}</div>
      <div class="pr-value">${r.prs.e1rm ? r.prs.e1rm.value.toFixed(1) : "—"} <span class="muted small">${u} e1RM</span></div>
    </div>`).join("");
}

function renderInsights() {
  const list = $("#insights-list"), intro = $("#insights-intro"), best = $("#best-sessions");
  if (!list) return;
  const ins = Analytics.insights();
  intro.textContent = ins.sessions < 6
    ? `Insights unlock after ~6 sessions with comparable lifts. You have ${ins.sessions}.`
    : `${ins.sessions} sessions · ${ins.withHealth} with Watch/sleep data · ${ins.withNutrition} with nutrition. "Quality" = share of lifts that beat your previous session.`;
  const ready = ins.results.filter(r => r.ready);
  const waiting = ins.results.filter(r => !r.ready);
  const bar = (v) => `<div class="ins-bar"><div style="width:${v == null ? 0 : Math.round(v * 100)}%"></div></div>`;
  list.innerHTML = ready.map(r => {
    const better = r.delta > 0.05 ? "a" : r.delta < -0.05 ? "b" : "none";
    const headline = better === "a" ? `Better sessions with ${r.a}` : better === "b" ? `Better sessions with ${r.b}` : `${r.label}: no clear difference yet`;
    return `<div class="insight ${better === "none" ? "neutral" : ""}">
      <div class="ins-title">${escapeHtml(headline)}</div>
      <div class="ins-grid">
        <div><div class="ins-label">${escapeHtml(r.a)} <span class="muted">n=${r.nA}</span></div>${bar(r.scoreA)}<div class="ins-num">${pct(r.scoreA)} improved · ${r.prA == null ? "—" : r.prA.toFixed(1)} PRs/session</div></div>
        <div><div class="ins-label">${escapeHtml(r.b)} <span class="muted">n=${r.nB}</span></div>${bar(r.scoreB)}<div class="ins-num">${pct(r.scoreB)} improved · ${r.prB == null ? "—" : r.prB.toFixed(1)} PRs/session</div></div>
      </div></div>`;
  }).join("") + (waiting.length ? `<div class="ins-waiting"><div class="health-group-title">Still collecting</div>${waiting.map(r => `<span class="split-pill"><i style="background:var(--text-faint)"></i>${escapeHtml(r.label)} <strong>${Math.min(r.nA, r.nB)}/3</strong></span>`).join("")}</div>` : "");
  if (!ready.length && !waiting.length) list.innerHTML = `<div class="muted small">Finish a few more workouts to start seeing patterns.</div>`;

  if (best) {
    best.innerHTML = ins.best.length ? ins.best.map(c => {
      const bits = [];
      if (c.sleep != null) bits.push(`${c.sleep.toFixed(1)}h sleep`);
      if (c.proteinHit != null) bits.push(c.proteinHit ? "protein ✓" : "protein ✗");
      if (c.hrv != null) bits.push(`HRV ${Math.round(c.hrv)}`);
      if (c.rhr != null) bits.push(`RHR ${Math.round(c.rhr)}`);
      if (c.restDays != null) bits.push(`${c.restDays} rest day${c.restDays === 1 ? "" : "s"}`);
      if (c.mins) bits.push(`${c.mins} min`);
      return `<div class="best-row" style="--hue:${hueFor(c.session.workout.day)}"><div><div class="sess-date">${escapeHtml(c.session.workout.day || "Workout")} <span class="muted">· ${prettyDate(c.date)}</span></div><div class="sess-line">${bits.length ? bits.join(" · ") : "no Health data for this day"}</div></div><div class="best-score"><strong>${pct(c.score)}</strong>${c.prs ? `<span class="pr-badge">${c.prs} PR</span>` : ""}</div></div>`;
    }).join("") : `<div class="muted small">Needs sessions with at least two comparable lifts.</div>`;
  }
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
        <div class="library-meta">${exerciseType(e) !== "strength" ? `<span class="type-tag ${exerciseType(e)}">${EXERCISE_TYPES[exerciseType(e)].label}</span> ` : ""}${e.defaultSets}×${escapeHtml(e.defaultRepRange || "?")} ${e.days.map(d => `<span class="tag">${d}</span>`).join("")}</div>
      </div>
      <span class="muted">›</span>
    </div>`).join("");
  list.querySelectorAll(".library-item").forEach(el => {
    el.onclick = () => openExerciseEditor(el.dataset.id);
  });
}

function openExerciseEditor(id, afterSave) {
  const modal = $("#exercise-edit-modal");
  const title = $("#exercise-edit-title");
  const nameInp = $("#exercise-edit-name");
  const typeInp = $("#exercise-edit-type");
  const setsInp = $("#exercise-edit-sets");
  const repInp = $("#exercise-edit-reprange");
  const daysInp = $("#exercise-edit-days");
  const delBtn = $("#btn-exercise-edit-delete");

  const isNew = !id;
  const ex = isNew ? { id: uid(), name: "", type: "strength", defaultSets: 3, defaultRepRange: "", days: [] } : state.exercises.find(e => e.id === id);
  if (!ex) return;
  title.textContent = isNew ? "New exercise" : "Edit exercise";
  nameInp.value = ex.name;
  typeInp.value = ex.type || "strength";
  setsInp.value = ex.defaultSets;
  repInp.value = ex.defaultRepRange;
  daysInp.value = ex.days.join(", ");
  delBtn.style.display = isNew ? "none" : "inline-flex";

  $("#btn-exercise-edit-save").onclick = () => {
    const name = nameInp.value.trim();
    if (!name) { toast("Name is required"); return; }
    ex.name = name;
    const newType = EXERCISE_TYPES[typeInp.value] ? typeInp.value : "strength";
    const oldType = exerciseType(ex);
    if (!isNew && oldType === "strength" && newType === "bodyweight") {
      // Logged weights were probably body weight on a machine, not added load — offer to clear them.
      const affected = state.workouts.filter(w => w.entries.some(e => e.exerciseId === ex.id && e.sets.some(s => parseNum(s.load) > 0)));
      if (affected.length && !confirm(`${affected.length} past session${affected.length > 1 ? "s" : ""} logged a weight for ${ex.name}.\n\nOK = keep those numbers as ADDED weight (belt/vest).\nCancel = clear them (they were body weight / machine weight).`)) {
        affected.forEach(w => { w.entries.forEach(e => { if (e.exerciseId === ex.id) e.sets.forEach(s => { s.load = ""; }); }); w.updatedAt = Date.now(); });
      }
    }
    ex.type = newType;
    ex.defaultSets = parseInt(setsInp.value) || 3;
    ex.defaultRepRange = repInp.value.trim();
    ex.days = daysInp.value.split(",").map(d => d.trim()).filter(Boolean);
    ex.updatedAt = Date.now();
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
    if (typeof afterSave === "function") afterSave(ex); else renderLibrary();
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

/* ───────── Templates view ───────── */
function renderTemplates() {
  const list = $("#templates-list");
  if (state.templates.length === 0) {
    list.innerHTML = `<div class="card muted" style="text-align:center;padding:30px">No templates yet. Tap + New to create one.</div>`;
    return;
  }
  list.innerHTML = state.templates.map(t => `
    <div class="card template-edit-card" data-id="${escapeHtml(t.id)}">
      <input class="template-name-input" type="text" value="${escapeHtml(t.name)}" placeholder="Template name" autocapitalize="words">
      <input class="template-subtitle-input" type="text" value="${escapeHtml(t.subtitle || "")}" placeholder="Subtitle (e.g. Chest · Shoulders)">
      <div class="template-exercise-list">
        ${t.exercises.length === 0
          ? `<div class="muted small" style="padding:8px 4px">No exercises yet.</div>`
          : t.exercises.map((ex, i) => `
            <div class="template-exercise-row" data-index="${i}">
              <button class="btn-reorder up" data-dir="up" data-index="${i}" aria-label="Move up">▲</button>
              <button class="btn-reorder down" data-dir="down" data-index="${i}" aria-label="Move down">▼</button>
              <span class="ex-text">${escapeHtml(ex)}</span>
              <button class="icon-btn danger btn-remove-tpl-ex" data-index="${i}" aria-label="Remove">×</button>
            </div>
          `).join("")}
      </div>
      <div class="row actions">
        <button class="btn btn-secondary btn-add-tpl-ex">+ Add exercise</button>
        <button class="btn btn-ghost danger btn-delete-tpl">Delete</button>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".template-edit-card").forEach(card => {
    const id = card.dataset.id;
    const t = state.templates.find(x => x.id === id);
    if (!t) return;

    const touch = () => { t.updatedAt = Date.now(); saveState(); };
    card.querySelector(".template-name-input").addEventListener("input", e => { t.name = e.target.value; touch(); });
    card.querySelector(".template-subtitle-input").addEventListener("input", e => { t.subtitle = e.target.value; touch(); });
    card.querySelectorAll(".btn-remove-tpl-ex").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const i = +btn.dataset.index;
        t.exercises.splice(i, 1);
        touch();
        renderTemplates();
      };
    });
    card.querySelectorAll(".btn-reorder").forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const i = +btn.dataset.index;
        const dir = btn.dataset.dir;
        const j = dir === "up" ? i - 1 : i + 1;
        if (j < 0 || j >= t.exercises.length) return;
        [t.exercises[i], t.exercises[j]] = [t.exercises[j], t.exercises[i]];
        touch();
        renderTemplates();
      };
    });
    card.querySelector(".btn-add-tpl-ex").onclick = () => {
      openPicker(exId => {
        const ex = state.exercises.find(e => e.id === exId);
        if (!ex) return;
        if (t.exercises.includes(ex.name)) {
          toast("Already in template");
          return;
        }
        t.exercises.push(ex.name);
        touch();
        renderTemplates();
      });
    };
    card.querySelector(".btn-delete-tpl").onclick = () => {
      if (!confirm(`Delete the "${t.name}" template?`)) return;
      state.templates = state.templates.filter(x => x.id !== id);
      saveState();
      renderTemplates();
      toast("Template deleted");
    };
  });
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
  const pgIn = $("#p-goal-protein"), cgIn = $("#p-goal-cal");
  if (pgIn) pgIn.value = p.goals?.protein || "";
  if (cgIn) cgIn.value = p.goals?.calories || "";
  updateProfileDisplay(p);
  const bwDate = $("#bw-date"); if (bwDate && !bwDate.value) bwDate.value = todayISO();
  renderStreakCard();
  renderBodyweightCard();
  renderNutritionSyncStatus();

  // Health snapshot
  renderHealthSnapshot();

  // Energy balance
  updateBalance(date, n);
}

function updateMacroDisplay(n) {
  const e = effectiveNutrition(n);
  const h = n.health || {};
  // Placeholders carry the Health-synced value so the field reads as filled but editable
  $("#m-protein").placeholder = h.protein != null ? String(Math.round(h.protein)) : "g";
  $("#m-carbs").placeholder   = h.carbs   != null ? String(Math.round(h.carbs))   : "g";
  $("#m-fat").placeholder     = h.fat     != null ? String(Math.round(h.fat))     : "g";
  $("#m-protein-kcal").textContent = `${fmt((e.protein || 0) * 4)} kcal`;
  $("#m-carbs-kcal").textContent   = `${fmt((e.carbs || 0) * 4)} kcal`;
  $("#m-fat-kcal").textContent     = `${fmt((e.fat || 0) * 9)} kcal`;
  $("#macro-total").textContent = `${fmt(e.kcal)} kcal`;
  const src = $("#macro-source");
  if (src) src.textContent = e.fromHealth ? "from Apple Health" : (Object.keys(h).length ? "typed · Health values greyed" : "");

  // Goals
  const p = state.profile;
  const pg = proteinGoalFor(p), cg = calorieGoalFor(p);
  const bar = (id, val, goal) => {
    const el = $(id); if (!el) return;
    const pct = goal ? Math.min(100, Math.round((val || 0) / goal * 100)) : 0;
    el.querySelector(".goal-fill").style.width = pct + "%";
    el.classList.toggle("met", !!goal && (val || 0) >= goal);
    el.classList.toggle("over", id === "#goal-cal" && !!goal && (val || 0) > goal * 1.1);
    el.querySelector(".goal-val").textContent = goal ? `${fmt(val || 0)} / ${fmt(goal)}` : fmt(val || 0);
  };
  bar("#goal-protein", e.protein, pg);
  bar("#goal-cal", e.kcal, cg);
  const pgIn = $("#p-goal-protein"), cgIn = $("#p-goal-cal");
  if (pgIn) pgIn.placeholder = pg ? `${pg} (suggested)` : "g";
  if (cgIn) cgIn.placeholder = cg ? `${cg} (TDEE)` : "kcal";
}

function renderStreakCard() {
  const host = $("#streak-card"); if (!host) return;
  const tier = streakTier(streakInfo().streak);
  const toNext = streakInfo().streak > 0 ? 7 - (streakInfo().streak % 7) : null;
  const nextTier = streakTier((Math.floor(streakInfo().streak / 7) + 1) * 7);
  const nextLine = toNext && toNext < 7 ? `<div class="muted small">${toNext} day${toNext > 1 ? "s" : ""} to ${nextTier.emoji} ${nextTier.label}</div>` : "";
  const dayRec = state.health?.daily?.[todayISO()] || {};
  const rawToday = dayRec.stepsToday ?? (healthDataIsFromToday() ? state.health?.data?.stepsToday : undefined);
  const rawSamples = dayRec.stepsRawToday ?? (healthDataIsFromToday() ? state.health?.data?.stepsRawToday : undefined);
  const calNote = rawToday == null ? "" : `<p class="muted small" style="margin:10px 0 0">
      Apple Health (de-duplicated) <strong>${fmt(rawToday)}</strong>${stepCalibration() !== 1 ? ` → calibrated <strong>${fmt(calSteps(rawToday))}</strong>` : ""}.
      ${rawSamples != null && Math.abs(rawSamples - rawToday) > 200 ? `Raw sample sum is ${fmt(rawSamples)} (iPhone + Watch overlap) — the de-duplicated figure is the one the Health app shows.` : ""}
    </p>`;
  const gI = $("#setting-step-goal"); if (gI && !gI.value) gI.value = state.settings.stepGoal;
  const wG = $("#setting-workout-goal"); if (wG && !wG.value) wG.value = state.settings.workoutGoalPerWeek;
  const rT = $("#setting-step-reminder"); if (rT) rT.checked = !!state.settings.stepReminder;
  const rH = $("#setting-step-reminder-hour"); if (rH && !rH.value) rH.value = state.settings.stepReminderHour;
  const s = streakInfo();
  const R = 30, C = 2 * Math.PI * R;
  const ringOff = C * (1 - s.pct);
  const dots = s.last14.map(d => {
    const cls = d.hit ? "hit" : d.known ? "miss" : "unknown";
    const dow = "SMTWTFS"[new Date(d.date + "T00:00:00").getDay()];
    return `<div class="streak-dot ${cls}${d.date === todayISO() ? " today" : ""}" title="${d.date}${d.steps != null ? ` · ${fmt(d.steps)}` : ""}"><i></i><span>${dow}</span></div>`;
  }).join("");
  host.innerHTML = `
    <div class="streak-top">
      <div class="streak-ring">
        <svg viewBox="0 0 72 72"><circle class="ring-bg" cx="36" cy="36" r="${R}"/><circle class="ring-fg${s.todayHit ? " done" : ""}" cx="36" cy="36" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${ringOff.toFixed(1)}"/></svg>
        <div class="ring-label"><strong>${fmt(s.todaySteps)}</strong><span>of ${fmt(s.goal)}</span></div>
      </div>
      <div class="streak-count">
        <div class="streak-flame ${s.streak > 0 ? "lit" : ""}">${tier.emoji} <strong>${s.streak}</strong></div>
        <div class="muted small">day streak${s.todayHit ? " · today ✓" : s.streak > 0 ? " · today pending" : ""}</div>
        ${tier.weeks > 0 ? `<div class="streak-tier${tier.milestone ? " milestone" : ""}">${tier.milestone ? "✨ " : ""}${tier.label}${tier.milestone ? " ✨" : ""}</div>` : ""}
        ${nextLine}
      </div>
    </div>
    <div class="streak-days">${dots}</div>
    <div class="wk-goal${s.weekHit ? " hit" : ""}">
      <span>🏋️ Workouts this week</span>
      <div class="wk-bar"><i style="width:${Math.min(100, (s.workouts / s.workoutGoal) * 100).toFixed(0)}%"></i></div>
      <strong>${s.workouts}/${s.workoutGoal}${s.weekHit ? " ✓" : ""}</strong>
    </div>
    <p class="muted small" style="margin:6px 0 0">Counts a session with 4+ sets, or any cardio.</p>
    ${calNote}
    <p class="muted small native-only" id="widget-status" style="margin:8px 0 0"></p>`;
  const bridge = window.Capacitor?.Plugins?.StreakBridge;
  if (bridge?.status) bridge.status().then(st => {
    const el = $("#widget-status"); if (!el) return;
    el.textContent = st.hasSnapshot
      ? `Widget sees: ${fmt(st.stepsToday ?? 0)} steps · updated ${new Date(st.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
      : "Widget: no snapshot yet — open this tab once more or reopen the app.";
  }).catch(() => {});
  const calA = $("#setting-cal-apple"), calB = $("#setting-cal-actual");
  if (calA && !calA.value && state.settings.stepCalApple) calA.value = state.settings.stepCalApple;
  if (calB && !calB.value && state.settings.stepCalActual) calB.value = state.settings.stepCalActual;
  const fl = $("#cal-factor-line");
  if (fl) fl.textContent = stepCalibration() !== 1
    ? `Calibration ×${stepCalibration().toFixed(2)} — streak, widget, and reminders use your real steps.`
    : "Optional: if Apple Health undercounts you, enter a measured pair and everything recalibrates.";
  syncStreakToNative();
}

let chartBodyweight;
function renderBodyweightCard() {
  const cur = $("#bw-current"); if (!cur) return;
  const latest = latestBodyweight();
  cur.innerHTML = latest
    ? `<div class="bw-big">${fmt(latest.lbs, 1)} <span class="tile-unit">${state.settings.units}</span></div><div class="muted small">${latest.date ? `${prettyDate(latest.date)} · ${latest.source === "health" ? "Apple Health" : "logged"}` : "from profile — log a reading to start a trend"}</div>`
    : `<div class="muted small">No readings yet.</div>`;
  const idx = bodyweightIndex();
  const list = $("#bw-list");
  if (list) list.innerHTML = idx.slice(-6).reverse().map(e => `<div class="bw-row"><span>${prettyDate(e.date)} <em class="muted">${e.source === "health" ? "Health" : "logged"}</em></span><strong>${fmt(e.lbs, 1)}</strong></div>`).join("") || "";
  const cv = $("#chart-bodyweight");
  if (cv) {
    if (chartBodyweight) { chartBodyweight.destroy(); chartBodyweight = null; }
    const since = isoDateLocal(new Date(Date.now() - 120 * 86400000));
    const pts = idx.filter(e => e.date >= since);
    cv.parentElement.classList.toggle("hidden", pts.length < 2);
    if (pts.length >= 2) {
      const c = chartBase();
      chartBodyweight = new Chart(cv, { type: "line",
        data: { labels: pts.map(e => e.date.slice(5)), datasets: [{ data: pts.map(e => e.lbs), borderColor: c.accent, backgroundColor: c.accent + "22", pointBackgroundColor: c.bg, pointBorderColor: c.accent, pointBorderWidth: 2, pointRadius: 3, borderWidth: 2, tension: 0.3, fill: true }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { displayColors: false, backgroundColor: c.elev, titleColor: c.text, bodyColor: c.text } },
          scales: { x: { ticks: { color: c.dim, font: { size: 10 }, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false }, border: { display: false } }, y: { ticks: { color: c.dim, font: { size: 10 }, maxTicksLimit: 4 }, grid: { color: c.grid }, border: { display: false } } } } });
    }
  }
}
function isoDateLocal(d) { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); }

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
  const intake = effectiveNutrition(n).kcal;
  const tdee = calcTDEE(state.profile);
  // If we have today's active-energy from Health, use BMR + active. Else fall back to TDEE.
  let outputKcal = tdee;
  let outputLabel = "TDEE estimate";
  const h = healthFor(date);
  if (h && h.activeEnergyToday != null) {
    const bmr = calcBMR(state.profile);
    outputKcal = bmr + parseNum(h.activeEnergyToday);
    outputLabel = `BMR + ${fmt(h.activeEnergyToday)} active`;
  }
  $("#bal-intake").textContent = fmt(intake);
  $("#bal-output").textContent = fmt(outputKcal);
  $("#bal-output-sub").textContent = outputLabel;

  const net = intake - outputKcal;
  const netEl = $("#bal-net");
  if (!intake) {
    netEl.textContent = isNativeApp() ? "Sync nutrition or type macros to see balance" : "Log macros to see balance";
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

// Health metrics for a given date: daily history first; for today, fall back to
// the latest snapshot (which the native sync / Shortcut keeps current).
// The "latest" snapshot is whatever the last sync produced — which, before the
// first sync of a new day, is YESTERDAY's numbers. Only treat it as today's when
// it was actually recorded today, or the app reports yesterday's steps as today's.
function healthDataIsFromToday() {
  const u = state.health?.data?.updatedAt;
  if (!u) return false;
  const d = new Date(u);
  return Number.isFinite(d.getTime()) && isoDateLocal(d) === todayISO();
}
function healthFor(date) {
  const daily = state.health?.daily?.[date];
  if (daily && Object.keys(daily).length) return { ...daily, _source: "daily" };
  if (date === todayISO() && state.health?.data && healthDataIsFromToday()) {
    return { ...state.health.data, _source: "latest" };
  }
  return null;
}

function renderHealthSnapshot() {
  const date = healthCurrentDate || todayISO();
  const h = healthFor(date);
  const hasAny = !!(h || (state.health?.data && Object.keys(state.health.data).length) || Object.keys(state.health?.daily || {}).length);
  const configured = hasAny || !!state.settings.gistId;
  $("#health-unconfigured").classList.toggle("hidden", configured);
  $("#health-snapshot").classList.toggle("hidden", !configured);
  if (!configured) return;

  const d = h || {};
  const set = (sel, val, suffix = "") => {
    $(sel).textContent = (val == null || val === "" || Number.isNaN(+val))
      ? "—"
      : (typeof val === "number" ? (Number.isInteger(val) || suffix === " bpm" || suffix === " kcal" ? fmt(Math.round(val)) : fmt(val, 1)) : val) + suffix;
  };
  set("#h-current-hr", d.currentHR, " bpm");
  set("#h-resting-hr", d.restingHR, " bpm");
  set("#h-hrv", d.hrv, " ms");
  set("#h-spo2", d.bloodOxygen, "%");
  set("#h-steps", calSteps(d.stepsToday), stepCalibration() !== 1 ? "" : "");
  set("#h-distance", d.distanceMiToday, " mi");
  set("#h-active", d.activeEnergyToday, " kcal");
  set("#h-resting-kcal", d.restingEnergyToday, " kcal");
  set("#h-exercise", d.exerciseMinutesToday, " min");
  set("#h-stand", d.standHoursToday, " hr");
  set("#h-sleep", d.sleepHours, " hr");
  const sc = sleepScoreFor(date);
  $("#h-sleep-score") && ($("#h-sleep-score").textContent = sc != null ? String(sc) : "—");
  if ($("#h-sleep-onset")) {
    if (d.sleepOnsetMin != null) {
      const mins = (d.sleepOnsetMin + 720) % 1440;
      const hh = Math.floor(mins / 60), mm = mins % 60;
      const h12 = ((hh + 11) % 12) + 1;
      $("#h-sleep-onset").textContent = `${h12}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
    } else $("#h-sleep-onset").textContent = "—";
  }
  $("#h-sleep-awake") && ($("#h-sleep-awake").textContent = d.sleepAwakeMin != null ? `${d.sleepAwakeMin} min · ${d.sleepWakeups ?? 0}×` : "—");
  set("#h-weight", d.weightLbs, " lbs");
  set("#h-bodyfat", d.bodyFatPct, "%");

  let updated;
  if (!h) updated = `No Health data recorded for ${prettyDate(date)}`;
  else if (h._source === "daily" && h.updatedAt) updated = `Recorded ${relativeTime(h.updatedAt)}`;
  else updated = `Latest sync ${relativeTime(state.health.lastFetch)}`;
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
  const gI = $("#setting-step-goal"); if (gI) gI.value = state.settings.stepGoal;
  const rT = $("#setting-step-reminder"); if (rT) rT.checked = !!state.settings.stepReminder;
  const rH = $("#setting-step-reminder-hour"); if (rH) rH.value = state.settings.stepReminderHour;
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
  $("#workout-start").addEventListener("change", e => {
    const w = getWorkout(activeWorkoutId); if (!w) return;
    w.startTime = e.target.value;
    saveState();
    renderDuration(w);
  });
  $("#workout-end").addEventListener("change", e => {
    const w = getWorkout(activeWorkoutId); if (!w) return;
    // Setting an end time only records it — the session stays open for edits
    // (back-logging a past workout sets times before the sets are even entered).
    // A session closes via "Finish workout" or the 1-hour idle auto-save.
    w.endTime = e.target.value;
    saveState();
    renderDuration(w);
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
  $("#btn-open-templates").onclick = () => showView("templates");
  $("#btn-sync-signin").onclick = async () => {
    const idInput = $("#sync-identifier");
    const pinInput = $("#sync-pin");
    const errEl = $("#sync-signin-error");
    errEl.textContent = "";
    const identifier = idInput.value.trim();
    const pin = pinInput.value;
    if (!identifier) { errEl.textContent = "Enter a name or email"; return; }
    if (!/^\d{4}$/.test(pin)) { errEl.textContent = "PIN must be exactly 4 digits"; return; }
    const btn = $("#btn-sync-signin");
    btn.disabled = true;
    btn.textContent = "Signing in…";
    try {
      const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("Sign-in timed out — check your connection and try again")), ms))]);
      const res = await withTimeout(window.WorkoutSync.signInWithPIN(identifier, pin), 25000);
      pinInput.value = "";
      if (res.created) toast(`New account created for "${identifier}"`);
      // Native app: kick off HealthKit (first run shows the iOS permission sheet)
      window.WorkoutNativeHealth?.start?.();
    } catch (e) {
      errEl.textContent = e.message || String(e);
    } finally {
      btn.disabled = false;
      btn.textContent = "Sign in / Create account";
    }
  };
  $("#btn-sync-signout").onclick = async () => {
    if (!confirm("Sign out? Your workouts stay in the cloud. This browser will show empty defaults until you sign in again.")) return;
    await window.WorkoutSync?.signOut?.();
    window.WorkoutNativeHealth?.stop?.();
    // Wipe local storage of user data so no data leaks to the next opener of this browser
    localStorage.removeItem(STORAGE_KEY);
    activeWorkoutId = null;
    state = defaultState();
    saveState();
    applyTheme();
    $("#history-filter") && ($("#history-filter").innerHTML = '<option value="">All exercises</option>');
    $("#progress-exercise") && ($("#progress-exercise").innerHTML = "");
    showView("settings");
    toast("Signed out");
  };
  $("#btn-sync-force").onclick = () => window.WorkoutSync?.forcePush?.();
  $("#btn-templates-add").onclick = () => {
    const name = (prompt("Template name (e.g. Upper, Lower, Core)") || "").trim();
    if (!name) return;
    state.templates.push({ id: uid(), name, subtitle: "", exercises: [], updatedAt: Date.now() });
    saveState();
    renderTemplates();
  };
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
  const goalInp = $("#setting-step-goal");
  if (goalInp) goalInp.onchange = e => {
    const v = Math.max(1000, Math.round(parseNum(e.target.value)));
    state.settings.stepGoal = v || 10000; e.target.value = state.settings.stepGoal;
    saveState(); renderStreakCard();
  };
  const remT = $("#setting-step-reminder");
  if (remT) remT.onchange = async e => {
    state.settings.stepReminder = e.target.checked;
    saveState();
    const bridge = window.Capacitor?.Plugins?.StreakBridge;
    if (e.target.checked && bridge) {
      try { const r = await bridge.requestNotifications(); if (r && r.granted === false) toast("Notifications are off in iOS Settings"); }
      catch {}
    }
    syncStreakToNative();
  };
  const wkG = $("#setting-workout-goal");
  if (wkG) wkG.onchange = e => {
    state.settings.workoutGoalPerWeek = Math.min(14, Math.max(1, Math.round(parseNum(e.target.value)) || 3));
    e.target.value = state.settings.workoutGoalPerWeek;
    saveState(); renderStreakCard();
  };
  const remH = $("#setting-step-reminder-hour");
  if (remH) remH.onchange = e => { state.settings.stepReminderHour = Math.min(22, Math.max(8, parseInt(e.target.value) || 19)); e.target.value = state.settings.stepReminderHour; saveState(); syncStreakToNative(); };

  const calPair = [["#setting-cal-apple", "stepCalApple"], ["#setting-cal-actual", "stepCalActual"]];
  calPair.forEach(([sel, key]) => {
    const el = $(sel);
    if (el) el.onchange = e => {
      const v = Math.round(parseNum(e.target.value));
      state.settings[key] = v > 0 ? v : null;
      saveState(); renderStreakCard();
    };
  });

  const bwBtn = $("#btn-bw-log");
  if (bwBtn) bwBtn.onclick = () => {
    const v = $("#bw-input").value;
    const d = $("#bw-date").value || todayISO();
    if (!logBodyweight(v, d)) { toast("Enter a weight"); return; }
    $("#bw-input").value = "";
    toast("Body weight logged");
    renderHealth();
  };
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
  const bfBtn = $("#btn-health-backfill");
  if (bfBtn) bfBtn.onclick = () => runFullBackfill(bfBtn);
  ["protein", "cal"].forEach(k => {
    const el = $(`#p-goal-${k}`); if (!el) return;
    el.addEventListener("input", e => {
      state.profile.goals = state.profile.goals || {};
      state.profile.goals[k === "cal" ? "calories" : "protein"] = parseNum(e.target.value) || null;
      saveState();
      updateMacroDisplay(getNutritionFor(healthCurrentDate || todayISO()));
    });
  });
  const nutBtn = $("#btn-nutrition-sync");
  if (nutBtn) nutBtn.onclick = async () => {
    if (!window.WorkoutNativeHealth?.syncNutrition) return;
    const label = nutBtn.textContent; nutBtn.disabled = true; nutBtn.textContent = "Reading Apple Health…";
    try {
      const n = await window.WorkoutNativeHealth.syncNutrition(14);
      toast(n ? `Nutrition synced · ${n} day${n === 1 ? "" : "s"}` : "No nutrition entries found in Health yet");
    } catch (e) { toast("Couldn't read nutrition: " + (e?.message || e)); }
    finally { nutBtn.disabled = false; nutBtn.textContent = label; renderHealth(); }
  };

  // Native HealthKit: first tap triggers the iOS permission sheet, then syncs.
  const runNativeHealthSync = async (btn, statusEl) => {
    if (!window.WorkoutNativeHealth?.isNative) return;
    if (!cloudUser) {
      if (statusEl) statusEl.textContent = "Sign in under Settings → Cloud Sync first.";
      toast("Sign in first");
      return;
    }
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = "Syncing…";
    if (statusEl) statusEl.textContent = "";
    try {
      await window.WorkoutNativeHealth.syncNow();   // merges into state + saveState()
      renderHealth();
      const got = state.health?.data && Object.keys(state.health.data).length > 1;
      if (got) toast("Apple Health synced");
      else if (statusEl) statusEl.textContent = "No data came back. Check Settings → Health → Data Access & Devices → Workout Tracker.";
    } catch (e) {
      if (statusEl) statusEl.textContent = "⚠ " + (e?.message || e);
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  };
  const connectBtn = $("#btn-health-connect");
  if (connectBtn) connectBtn.onclick = () => runNativeHealthSync(connectBtn, $("#health-connect-status"));
  const syncNowBtn = $("#btn-health-sync-now");
  if (syncNowBtn) syncNowBtn.onclick = () => runNativeHealthSync(syncNowBtn, null);

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

// Register service worker for offline + PWA install (which protects iOS data
// from the 7-day Safari purge once added to home screen)
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").catch(err => {
    console.warn("SW registration failed:", err);
  });
}

// Ask the browser to keep our data even under storage pressure
function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return;
  navigator.storage.persist().then(granted => {
    console.log("Persistent storage granted:", granted);
  });
}

// Banner reminding iOS Safari users to Add to Home Screen (one-time, dismissible)
function maybeShowInstallBanner() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = window.navigator.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches;
  if (!isIOS || isStandalone) return;
  if (localStorage.getItem("install-banner-dismissed")) return;
  const banner = document.getElementById("install-banner");
  if (banner) banner.classList.remove("hidden");
}

/* ───────── Native HealthKit bridge (see capacitor-health.js) ───────── */
// Called by the native shell with freshly read HealthKit metrics. Merges into
// state.health.data; saveState() pushes to Firestore via the normal sync path.
// Historical backfill: merge {date: metrics} into daily history. Live-synced
// values win over backfilled ones for the same date+field.
window.__applyDailyBackfill = (map) => {
  if (!map || typeof map !== "object") return;
  state.health = state.health || { lastFetch: null, data: null, lastError: null, daily: {} };
  state.health.daily = state.health.daily || {};
  const now = Date.now();
  for (const [date, vals] of Object.entries(map)) {
    const existing = state.health.daily[date] || {};
    state.health.daily[date] = { ...vals, ...existing, updatedAt: Math.max(existing.updatedAt || 0, now) };
  }
  state.health.backfilledAt = now;
  saveState();
};

// Enrich past workouts (with start+end times) from their HealthKit window,
// then stamp sleep context now that daily history exists.
async function backfillWorkoutHealth(onProgress) {
  const native = window.WorkoutNativeHealth;
  if (!native?.isNative) return 0;
  const targets = state.workouts.filter(w => w.id !== activeWorkoutId && w.startTime && w.endTime && !(w.health && w.health.avgHR));
  let i = 0, hit = 0;
  for (const w of targets) {
    onProgress?.(++i, targets.length);
    try {
      const data = await native.enrichWorkout({ date: w.date, startTime: w.startTime, endTime: w.endTime });
      if (data) { w.health = { ...data, ...(w.health || {}) }; hit++; }
    } catch (e) { console.warn("workout enrich failed:", e?.message || e); }
    attachDailyContext(w);
    w.updatedAt = Date.now();
  }
  // Sleep context for workouts without times, too
  state.workouts.forEach(w => { if (w.id !== activeWorkoutId) attachDailyContext(w); });
  saveState();
  return hit;
}

async function runFullBackfill(btn) {
  const native = window.WorkoutNativeHealth;
  if (!native?.isNative) { toast("Open the iPhone app to backfill"); return; }
  const label = btn ? (t) => { btn.disabled = true; btn.textContent = t; } : () => {};
  try {
    // Cover back to the earliest workout (+ a 2-week sleep-baseline runway)
    const earliest = state.workouts.map(w => w.date).sort()[0] || todayISO();
    const days = Math.min(730, Math.max(90, Math.ceil((Date.now() - Date.parse(earliest)) / 86400000) + 14));
    label("Reading Apple Health…");
    const daysFilled = await native.backfillHistory(days, (stage) => label(`Reading ${stage}…`));
    label("Matching workouts…");
    const enriched = await backfillWorkoutHealth((i, n) => label(`Workout ${i}/${n}…`));
    toast(`Backfilled ${daysFilled} days · ${enriched} workouts enriched`);
    renderHealth();
  } catch (e) {
    toast("Backfill failed: " + (e?.message || e));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Backfill Apple Health history"; }
  }
}

// Daily step totals for recent days. Past days only ever move UP (a day logged
// at noon shouldn't stay stuck at its midday count and break the streak); today
// is owned by the live sync, so it's left alone here.
window.__applyStepHistory = (map) => {
  if (!map || typeof map !== "object") return;
  state.health = state.health || { lastFetch: null, data: null, lastError: null, daily: {} };
  state.health.daily = state.health.daily || {};
  const today = todayISO();
  let changed = false;
  for (const [date, steps] of Object.entries(map)) {
    const v = Math.round(Number(steps) || 0);
    if (v <= 0 || date === today) continue;
    const rec = (state.health.daily[date] ||= {});
    const cur = Number.isFinite(+rec.stepsToday) ? +rec.stepsToday : 0;
    if (v > cur) { rec.stepsToday = v; rec.updatedAt = Date.now(); changed = true; }
  }
  if (changed) {
    saveState();
    if (document.getElementById("streak-card")) renderStreakCard();
    syncStreakToNative();
  }
};

window.__applyNativeHealth = (metrics) => {
  if (!metrics || typeof metrics !== "object") return;
  state.health = state.health || { lastFetch: null, data: null, lastError: null, daily: {} };
  state.health.daily = state.health.daily || {};
  const now = Date.now();
  state.health.data = { ...(state.health.data || {}), ...metrics, updatedAt: new Date(now).toISOString() };
  // Daily history keyed by local date — "today" metrics (steps/kcal) accumulate
  // through the day, so later syncs overwrite earlier ones for the same date.
  const today = todayISO();
  state.health.daily[today] = { ...(state.health.daily[today] || {}), ...metrics, updatedAt: now };
  state.health.lastFetch = now;
  state.health.lastError = null;
  saveState();
  syncStreakToNative();
  if (document.querySelector("#view-health.active")) renderHealth();
};

// Called by the native shell with per-day totals read from Apple Health
// (written there by MyFitnessPal / Cronometer / any food logger).
window.__applyNativeNutrition = (days) => {
  if (!days || typeof days !== "object") return;
  let touched = 0;
  for (const [date, vals] of Object.entries(days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const clean = {};
    for (const k of ["calories", "protein", "carbs", "fat"]) if (Number.isFinite(vals[k])) clean[k] = Math.round(vals[k]);
    if (!Object.keys(clean).length) continue;
    let n = state.nutrition.find(x => x.date === date);
    if (!n) { n = { date, protein: "", carbs: "", fat: "", notes: "" }; state.nutrition.push(n); }
    n.health = { ...clean, syncedAt: Date.now() };
    n.updatedAt = Date.now();
    touched++;
  }
  state.nutritionSyncedAt = Date.now();
  if (touched) saveState();
  if (document.querySelector("#view-health.active")) renderHealth();
};
function renderNutritionSyncStatus() {
  const el = $("#nutrition-sync-status"); if (!el) return;
  el.textContent = state.nutritionSyncedAt ? `Last nutrition sync ${relativeTime(state.nutritionSyncedAt)}` : "Not synced yet";
}

/* ───────── Cloud sync bridge (Firebase — see firebase-sync.js) ───────── */
let cloudUser = null;
let cloudLastPushed = null;
let cloudError = null;

window.__getState = () => state;

window.__onAuthChanged = (user) => {
  cloudUser = user;
  renderSyncCard();
};

// Apply an inbound cloud state by MERGING it with local. Pushes back only if
// the merge produced something the cloud doesn't already have (so two devices
// converge and go quiet instead of echoing pushes at each other).
function adoptCloudState(remoteState, { toastMsg } = {}) {
  const remote = migrate(JSON.parse(JSON.stringify(remoteState)));
  const merged = migrate(mergeStates(state, remote));
  const changedVsRemote = stateFingerprint(merged) !== stateFingerprint(remote);
  const changedVsLocal  = stateFingerprint(merged) !== stateFingerprint(state);
  state = merged;
  // If the in-progress workout vanished in the merge (deleted elsewhere), drop it
  if (activeWorkoutId && !state.workouts.find(w => w.id === activeWorkoutId)) activeWorkoutId = null;
  if (changedVsRemote) saveState(); else saveStateLocalOnly();
  if (changedVsLocal) {
    // Dropdown caches rebuild on next render
    const hf = document.getElementById("history-filter"); if (hf) hf.innerHTML = '<option value="">All exercises</option>';
    const pe = document.getElementById("progress-exercise"); if (pe) pe.innerHTML = "";
    const active = document.querySelector(".view.active");
    showView(active ? active.id.replace("view-", "") : "today");
    if (toastMsg) toast(toastMsg);
    syncStreakToNative();
  }
  return { changedVsRemote, changedVsLocal };
}

window.__onCloudMerge = ({ direction, remote }) => {
  if (direction === "pull" && remote) {
    const r = adoptCloudState(remote, { toastMsg: "Synced with cloud" });
    if (!r.changedVsLocal) toast("Up to date");
  } else if (direction === "push") {
    toast("Uploaded workouts to cloud");
  }
};

window.__onCloudUpdated = (remoteState) => {
  adoptCloudState(remoteState, { toastMsg: "Updated from another device" });
};

window.__onSyncStatus = (s) => {
  const wasOffline = !syncStatus.online;
  syncStatus = { ...syncStatus, ...s };
  updateSavedIndicator();
  renderSyncCard();
  if (wasOffline && syncStatus.online) toast("Back online — syncing");
};

window.__onCloudPushed = () => {
  cloudLastPushed = Date.now();
  cloudError = null;
  renderSyncCard();
};

window.__onCloudError = (msg) => {
  cloudError = msg;
  renderSyncCard();
};

function renderSyncCard() {
  const signedIn = !!cloudUser;
  const outEl = document.getElementById("sync-signed-out");
  const inEl = document.getElementById("sync-signed-in");
  if (!outEl || !inEl) return;
  outEl.classList.toggle("hidden", signedIn);
  inEl.classList.toggle("hidden", !signedIn);
  if (signedIn) {
    // PIN accounts use a synthetic "<name>@workout-tracker.local" address — show the name, not the plumbing.
    const email = cloudUser.email || "";
    const isPin = email.endsWith("@workout-tracker.local");
    const friendly = cloudUser.name || (isPin ? email.split("@")[0] : email);
    document.getElementById("sync-name").textContent = friendly;
    document.getElementById("sync-email").textContent = isPin ? "Signed in · syncing to cloud" : email;
    const avatar = document.getElementById("sync-avatar");
    if (cloudUser.photoURL) avatar.src = cloudUser.photoURL;
    else avatar.style.display = "none";
    let status = "Synced";
    if (cloudLastPushed) status = `Last sync ${relativeTime(cloudLastPushed)}`;
    if (syncStatus.pendingPush) status = "Changes waiting to sync…";
    if (!syncStatus.online) status = "Offline — changes are saved on this device and will sync when you're back online";
    if (cloudError) status = `⚠ ${cloudError}`;
    document.getElementById("sync-status").textContent = status;
  }
}
setInterval(renderSyncCard, 15000);

// True when running inside the Capacitor iOS shell (vs. a browser / PWA).
const isNativeApp = () => !!(window.Capacitor?.isNativePlatform?.());

function init() {
  applyTheme();
  bindEvents();
  // The service worker is the offline layer for BOTH the web PWA and the
  // native shell (which loads the live site in remote mode — WKAppBoundDomains
  // makes SWs available there). Only the legacy bundled capacitor:// scheme
  // has no use for it.
  if (location.protocol !== "capacitor:") registerServiceWorker();
  if (!isNativeApp()) {
    requestPersistentStorage();
    maybeShowInstallBanner();
  } else {
    document.documentElement.classList.add("native");
  }

  // Reset inactivity timer on any user interaction
  ["input", "click", "touchstart"].forEach(ev => {
    document.addEventListener(ev, resetInactivityTimer, { passive: true });
  });

  // Dismiss install banner
  const dismissInstall = document.getElementById("btn-dismiss-install");
  if (dismissInstall) {
    dismissInstall.onclick = () => {
      localStorage.setItem("install-banner-dismissed", "1");
      document.getElementById("install-banner").classList.add("hidden");
    };
  }

  // Safety-net saves so iOS Safari can't drop unsaved state when backgrounded
  const flushOnHide = () => {
    saveStateLocalOnly();
    if (window.WorkoutSync?.hasPendingPush?.()) window.WorkoutSync.forcePush();
  };
  // Any return to the app refreshes the widget snapshot, whatever tab is showing —
// the widget must never be able to disagree with what the app knows.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) setTimeout(syncStreakToNative, 300);
}, { capture: true });

document.addEventListener("visibilitychange", () => { if (document.hidden) flushOnHide(); });
  window.addEventListener("pagehide", flushOnHide);
  window.addEventListener("beforeunload", flushOnHide);

  // Accept ?gist=<id> in the URL to auto-configure on first tap
  const urlGist = new URL(location.href).searchParams.get("gist");
  if (urlGist && urlGist !== state.settings.gistId) {
    state.settings.gistId = urlGist;
    saveState();
    toast("Apple Health gist configured");
    history.replaceState({}, "", location.pathname);
  }
  // One-time automatic history backfill: runs quietly once HealthKit is
  // already authorized, so past workouts and nights fill in without a tap.
  if (window.WorkoutNativeHealth?.isNative) {
    setTimeout(() => {
      if (!state.health?.backfilledAt && window.WorkoutNativeHealth.authorized?.()) {
        runFullBackfill(document.getElementById("btn-health-backfill"));
      }
    }, 6000);
  }

  // Kick off a background Health sync if a Gist is configured
  if (state.settings.gistId) syncHealth();
  // If there's an in-progress workout (last one with empty entries from a refresh), revive it
  const inProgress = state.workouts.find(w => w.date === todayISO() && w.entries.length > 0 && w.entries.some(e => e.sets.some(s => s.load === "" && s.reps === "")));
  // Don't auto-revive — make user explicitly start. activeWorkoutId stays null.
  showView("today");
}

init();
