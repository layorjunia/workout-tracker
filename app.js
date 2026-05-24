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
    "Day 5": ["Squats","Barbell Shrugs","Roman Chair","Leg Curl Machine","Hip Abduction","Ab Twist Machine","Seated Leg Extension","Hip Adduction","Squats Leg Press","Ab Oblique Crunch Machine"],
  },
  exercises: [
    {name:"Ab Oblique Crunch Machine", defaultSets:3, defaultRepRange:"10–12", days:["Day 5"]},
    {name:"Ab Twist Machine", defaultSets:3, defaultRepRange:"12-15", days:["Day 1","Day 5"]},
    {name:"Barbell Shrugs", defaultSets:3, defaultRepRange:"8–10", days:["Day 2","Day 5"]},
    {name:"Cable Ab Curl", defaultSets:3, defaultRepRange:"10–15", days:["Day 2"]},
    {name:"Cable Face Pull", defaultSets:3, defaultRepRange:"10–15", days:["Day 2"]},
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
function defaultState() {
  return {
    schemaVersion: 1,
    exercises: SEED.exercises.map(e => ({ id: uid(), ...e })),
    days: { ...SEED.days },
    workouts: [],
    settings: { units: "lbs", theme: "dark" },
  };
}
function migrate(s) {
  s.schemaVersion ??= 1;
  s.exercises ??= [];
  s.days ??= { ...SEED.days };
  s.workouts ??= [];
  s.settings ??= { units: "lbs", theme: "dark" };
  s.settings.units ??= "lbs";
  s.settings.theme ??= "dark";
  return s;
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

function startNewWorkout() {
  // Suggest "Day N" — rotate based on last workout's day if available
  const last = state.workouts.slice().sort((a,b) => b.date.localeCompare(a.date))[0];
  const dayKeys = Object.keys(state.days).filter(k => state.days[k].length > 0);
  let suggested = "";
  if (last && last.day) {
    const i = dayKeys.indexOf(last.day);
    if (i >= 0) suggested = dayKeys[(i + 1) % dayKeys.length];
  } else if (dayKeys.length) {
    suggested = dayKeys[0];
  }
  const w = {
    id: uid(),
    date: todayISO(),
    day: suggested,
    notes: "",
    entries: [],
    createdAt: Date.now(),
  };
  state.workouts.push(w);
  activeWorkoutId = w.id;
  // Pre-populate exercises from template
  if (suggested && state.days[suggested]) {
    state.days[suggested].forEach(name => {
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
  dropdown.innerHTML = '<option value="">(no template)</option>';
  Object.keys(state.days).forEach(d => {
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
    if (!confirm(`Remove ${ex.name} from this workout?`)) return;
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
          <button class="icon-btn danger btn-del-workout" aria-label="Delete">×</button>
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
      if (e.target.closest(".btn-del-workout")) return;
      el.classList.toggle("open");
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

/* ───────── Settings ───────── */
function renderSettings() {
  $("#setting-units").value = state.settings.units;
  $("#setting-theme").value = state.settings.theme;
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

  $("#btn-new-workout").onclick = startNewWorkout;
  $("#btn-new-workout-empty").onclick = startNewWorkout;
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
    if (e.target.value && state.days[e.target.value] && w.entries.length === 0) {
      // Pre-populate if entries are empty
      state.days[e.target.value].forEach(name => {
        const ex = findOrCreateExercise(name);
        addEntry(ex.id);
      });
    }
    saveState(); renderToday();
  });
  $("#workout-notes").addEventListener("input", e => {
    const w = getWorkout(activeWorkoutId); if (w) { w.notes = e.target.value; saveState(); }
  });

  $("#library-search").addEventListener("input", renderLibrary);
  $("#btn-add-library").onclick = () => openExerciseEditor(null);
  $("#btn-exercise-edit-close").onclick = () => $("#exercise-edit-modal").classList.add("hidden");

  $("#setting-units").onchange = e => { state.settings.units = e.target.value; saveState(); renderToday(); };
  $("#setting-theme").onchange = e => { state.settings.theme = e.target.value; saveState(); applyTheme(); };
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
  // If there's an in-progress workout (last one with empty entries from a refresh), revive it
  const inProgress = state.workouts.find(w => w.date === todayISO() && w.entries.length > 0 && w.entries.some(e => e.sets.some(s => s.load === "" && s.reps === "")));
  // Don't auto-revive — make user explicitly start. activeWorkoutId stays null.
  showView("today");
}

init();
