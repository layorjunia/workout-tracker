/* Analytics — pure functions over `state`. Loaded after app.js (uses its helpers:
   parseNum, oneRM, setVolume, setHasData, exerciseType, isoWeek, todayISO,
   healthFor, getNutritionFor, effectiveNutrition, proteinGoalFor, durationMinutes).

   Principles:
   • Compare like with like: an exercise against its own previous session, a
     split against the same split — never this week's total against last week's.
   • PRs are detected by replaying history in order, per exercise, so they are
     real events with dates, not "max so far".
   • Insights are bucketed comparisons that only surface with enough sessions on
     both sides. */

const Analytics = (() => {
  const EPS_E1RM = 0.01;   // +1% e1RM counts as an improvement
  const EPS_VOL  = 0.05;   // +5% volume counts when e1RM didn't drop
  const REGRESS  = 0.03;   // −3% e1RM counts as a regression

  const completedWorkouts = () =>
    state.workouts
      .filter(w => w.id !== activeWorkoutId && w.entries?.some(e => e.sets?.some(setHasData)))
      .slice()
      .sort((a, b) => (a.date + String(a.createdAt || 0)).localeCompare(b.date + String(b.createdAt || 0)));

  const exById = (id) => state.exercises.find(e => e.id === id);

  // ── Per-entry summary (type-aware) ─────────────────────────────────────
  function entrySummary(entry, date) {
    const ex = exById(entry.exerciseId);
    const type = exerciseType(ex);
    const sets = (entry.sets || []).filter(setHasData);
    const s = { exerciseId: entry.exerciseId, name: ex?.name || "Unknown", type, sets: sets.length };
    if (type === "strength") {
      let best = 0, topLoad = 0, repsAtTop = 0, vol = 0, reps = 0;
      for (const st of sets) {
        const L = parseNum(st.load), R = parseNum(st.reps);
        const e = oneRM(L, R);
        if (e > best) best = e;
        if (L > topLoad || (L === topLoad && R > repsAtTop)) { topLoad = L; repsAtTop = R; }
        vol += L * R; reps += R;
      }
      Object.assign(s, { e1rm: best, topLoad, repsAtTop, volume: vol, reps });
    } else if (type === "bodyweight") {
      // Added weight (belt/vest) is optional; "top set" = heaviest added load, then most reps.
      // Effective load = body weight on that date + added, so 10 @ 220 vs 5 @ 250 compare honestly.
      const bwRec = date ? bodyweightOn(date) : null;
      const bw = bwRec ? bwRec.lbs : 0;
      let topLoad = 0, repsAtTop = 0, effE1rm = 0, effVolume = 0;
      for (const st of sets) {
        const L = parseNum(st.load), R = parseNum(st.reps);
        if (L > topLoad || (L === topLoad && R > repsAtTop)) { topLoad = L; repsAtTop = R; }
        if (bw > 0) { effE1rm = Math.max(effE1rm, oneRM(bw + L, R)); effVolume += (bw + L) * R; }
      }
      s.reps = sets.reduce((a, st) => a + parseNum(st.reps), 0);
      s.bestSet = Math.max(0, ...sets.map(st => parseNum(st.reps)));
      s.topLoad = topLoad; s.repsAtTop = repsAtTop;
      s.bw = bw; s.effE1rm = effE1rm; s.effVolume = effVolume;
      s.relStrength = bw > 0 ? (bw + topLoad) / bw : null;
    } else if (type === "timed") {
      s.seconds = sets.reduce((a, st) => a + parseNum(st.seconds), 0);
      s.bestSet = Math.max(0, ...sets.map(st => parseNum(st.seconds)));
    } else {
      const dur = sets.reduce((a, st) => a + parseNum(st.duration), 0);
      const dist = sets.reduce((a, st) => a + parseNum(st.distance), 0);
      const hr = sets.map(st => parseNum(st.avgHR)).filter(Boolean);
      Object.assign(s, { duration: dur, distance: dist, pace: dur && dist ? dur / dist : null, avgHR: hr.length ? hr.reduce((a, b) => a + b, 0) / hr.length : null });
    }
    return s;
  }

  // ── Compare an exercise occurrence to its previous occurrence ──────────
  function compareEntry(now, prev) {
    if (!prev) return { status: "first", notes: [] };
    const notes = [];
    let status = "flat";
    if (now.type === "strength") {
      if (prev.e1rm > 0 && now.e1rm >= prev.e1rm * (1 + EPS_E1RM)) {
        status = "up"; notes.push(`e1RM ${Math.round(prev.e1rm)} → ${Math.round(now.e1rm)}`);
      } else if (prev.e1rm > 0 && now.e1rm <= prev.e1rm * (1 - REGRESS)) {
        status = "down"; notes.push(`e1RM ${Math.round(prev.e1rm)} → ${Math.round(now.e1rm)}`);
      }
      if (now.topLoad === prev.topLoad && now.repsAtTop > prev.repsAtTop) {
        if (status !== "down") status = "up";
        notes.push(`+${now.repsAtTop - prev.repsAtTop} rep${now.repsAtTop - prev.repsAtTop > 1 ? "s" : ""} at ${now.topLoad}`);
      } else if (now.topLoad > prev.topLoad) {
        if (status !== "down") status = "up";
        notes.push(`+${now.topLoad - prev.topLoad} ${state.settings.units} top set`);
      }
      if (status === "flat" && prev.volume > 0 && now.volume >= prev.volume * (1 + EPS_VOL) && now.e1rm >= prev.e1rm * (1 - EPS_E1RM)) {
        status = "up"; notes.push(`volume +${Math.round((now.volume / prev.volume - 1) * 100)}%`);
      }
    } else if (now.type === "bodyweight") {
      const u = state.settings.units;
      const bwNote = now.bw && prev.bw && Math.abs(now.bw - prev.bw) >= 1 ? ` (BW ${Math.round(prev.bw)}→${Math.round(now.bw)})` : "";
      // Prefer the effective e1RM when both sessions have a body-weight reading
      if (now.effE1rm > 0 && prev.effE1rm > 0) {
        if (now.effE1rm >= prev.effE1rm * (1 + EPS_E1RM)) { status = "up"; notes.push(`e1RM ${Math.round(prev.effE1rm)} → ${Math.round(now.effE1rm)}${bwNote}`); }
        else if (now.effE1rm <= prev.effE1rm * (1 - REGRESS)) { status = "down"; notes.push(`e1RM ${Math.round(prev.effE1rm)} → ${Math.round(now.effE1rm)}${bwNote}`); }
        else if (now.reps > prev.reps) { status = "up"; notes.push(`+${now.reps - prev.reps} reps${bwNote}`); }
        else notes.push(`same${bwNote}`);
      }
      else if (now.topLoad > (prev.topLoad || 0)) { status = "up"; notes.push(`+${now.topLoad - (prev.topLoad || 0)} ${u} added`); }
      else if (now.topLoad === (prev.topLoad || 0) && now.repsAtTop > (prev.repsAtTop || 0) && now.topLoad > 0) { status = "up"; notes.push(`+${now.repsAtTop - prev.repsAtTop} reps at +${now.topLoad}`); }
      else if (now.topLoad < (prev.topLoad || 0) && now.reps <= prev.reps) { status = "down"; notes.push(`−${(prev.topLoad || 0) - now.topLoad} ${u} added`); }
      else if (now.reps > prev.reps) { status = "up"; notes.push(`+${now.reps - prev.reps} reps`); }
      else if (now.reps < prev.reps * 0.9) { status = "down"; notes.push(`${now.reps - prev.reps} reps`); }
    } else if (now.type === "timed") {
      if (now.seconds > prev.seconds) { status = "up"; notes.push(`+${now.seconds - prev.seconds}s`); }
      else if (now.seconds < prev.seconds * 0.9) { status = "down"; notes.push(`${now.seconds - prev.seconds}s`); }
    } else {
      if (now.distance > prev.distance * 1.02) { status = "up"; notes.push(`+${(now.distance - prev.distance).toFixed(1)} mi`); }
      if (now.pace && prev.pace && now.pace < prev.pace * 0.98) { status = "up"; notes.push("faster pace"); }
      if (status === "flat" && now.duration > prev.duration * 1.05) { status = "up"; notes.push(`+${Math.round(now.duration - prev.duration)} min`); }
      if (now.duration < prev.duration * 0.8 && now.distance < prev.distance * 0.8) { status = "down"; notes.push("shorter"); }
    }
    return { status, notes };
  }

  // ── Replay history: per-session comparisons + PR events ────────────────
  let cache = null;
  function replay() {
    const sig = state.lastModified + ":" + state.workouts.length + ":" + (activeWorkoutId || "");
    if (cache && cache.sig === sig) return cache;
    const workouts = completedWorkouts();
    const lastByEx = new Map();                // exerciseId → last entrySummary
    const seenByEx = new Map();                // exerciseId → sessions seen (for PR baseline)
    const recs = new Map();                    // exerciseId → { e1rm, load, repsAt: Map(load→reps), volume }
    const prEvents = [];
    const sessions = [];

    for (const w of workouts) {
      const items = [];
      let prs = 0;
      for (const entry of w.entries || []) {
        const now = entrySummary(entry, w.date);
        if (!now.sets) continue;
        const prev = lastByEx.get(now.exerciseId) || null;
        const cmp = compareEntry(now, prev);
        const seen = seenByEx.get(now.exerciseId) || 0;

        // PR detection (strength only, needs a baseline session)
        const r = recs.get(now.exerciseId) || { e1rm: 0, load: 0, repsAt: new Map(), volume: 0 };
        const newPRs = [];
        if (now.type === "strength") {
          if (seen > 0) {
            if (now.e1rm > r.e1rm * (1 + 0.005) && now.e1rm > 0) newPRs.push({ kind: "e1rm", value: now.e1rm, prevValue: r.e1rm });
            if (now.topLoad > r.load) newPRs.push({ kind: "load", value: now.topLoad, prevValue: r.load });
            const prevRepsAt = r.repsAt.get(now.topLoad) || 0;
            if (prevRepsAt > 0 && now.repsAtTop > prevRepsAt) newPRs.push({ kind: "reps", value: now.repsAtTop, prevValue: prevRepsAt, load: now.topLoad });
            if (now.volume > r.volume && r.volume > 0) newPRs.push({ kind: "volume", value: now.volume, prevValue: r.volume });
          }
          r.e1rm = Math.max(r.e1rm, now.e1rm);
          r.load = Math.max(r.load, now.topLoad);
          for (const st of (entry.sets || []).filter(setHasData)) {
            const L = parseNum(st.load), R = parseNum(st.reps);
            if (R > (r.repsAt.get(L) || 0)) r.repsAt.set(L, R);
          }
          r.volume = Math.max(r.volume, now.volume);
          recs.set(now.exerciseId, r);
        } else if (now.type === "bodyweight") {
          // Effective e1RM PR (BW + added), rep PR at a given added load, heaviest added weight
          if (seen > 0 && now.effE1rm > 0 && (r.effE1rm || 0) > 0 && now.effE1rm > r.effE1rm * 1.005) newPRs.push({ kind: "e1rm", value: now.effE1rm, prevValue: r.effE1rm, bw: true });
          r.effE1rm = Math.max(r.effE1rm || 0, now.effE1rm);
          const prevRepsAt = r.repsAt.get(now.topLoad) || 0;
          if (seen > 0 && now.topLoad > 0 && now.topLoad > r.load) newPRs.push({ kind: "load", value: now.topLoad, prevValue: r.load });
          if (seen > 0 && prevRepsAt > 0 && now.repsAtTop > prevRepsAt) newPRs.push({ kind: "reps", value: now.repsAtTop, prevValue: prevRepsAt, load: now.topLoad, bw: true });
          if (seen > 0 && now.topLoad === 0 && now.reps > (r.best || 0) && (r.best || 0) > 0) newPRs.push({ kind: "reps", value: now.reps, prevValue: r.best, total: true, bw: true });
          r.load = Math.max(r.load, now.topLoad);
          for (const st of (entry.sets || []).filter(setHasData)) {
            const L = parseNum(st.load), R = parseNum(st.reps);
            if (R > (r.repsAt.get(L) || 0)) r.repsAt.set(L, R);
          }
          if (now.topLoad === 0) r.best = Math.max(r.best || 0, now.reps);
          recs.set(now.exerciseId, r);
        } else if (now.type === "timed") {
          if (seen > 0 && now.seconds > (r.best || 0)) newPRs.push({ kind: "seconds", value: now.seconds, prevValue: r.best || 0 });
          r.best = Math.max(r.best || 0, now.seconds); recs.set(now.exerciseId, r);
        } else if (now.type === "cardio") {
          if (seen > 0 && now.distance > (r.distance || 0) && now.distance > 0) newPRs.push({ kind: "distance", value: now.distance, prevValue: r.distance || 0 });
          if (seen > 0 && now.pace && r.pace && now.pace < r.pace) newPRs.push({ kind: "pace", value: now.pace, prevValue: r.pace });
          r.distance = Math.max(r.distance || 0, now.distance);
          if (now.pace) r.pace = r.pace ? Math.min(r.pace, now.pace) : now.pace;
          recs.set(now.exerciseId, r);
        }
        for (const pr of newPRs) prEvents.push({ date: w.date, workoutId: w.id, exerciseId: now.exerciseId, name: now.name, ...pr });
        prs += newPRs.length;

        items.push({ ...now, prev, status: cmp.status, notes: cmp.notes, prs: newPRs });
        lastByEx.set(now.exerciseId, now);
        seenByEx.set(now.exerciseId, seen + 1);
      }
      const compared = items.filter(i => i.status !== "first");
      const improved = compared.filter(i => i.status === "up").length;
      const regressed = compared.filter(i => i.status === "down").length;
      sessions.push({
        workout: w, items, improved, regressed, compared: compared.length, prs,
        score: compared.length ? improved / compared.length : null,
      });
    }
    cache = { sig, sessions, prEvents, records: recs };
    return cache;
  }

  // ── Week helpers ───────────────────────────────────────────────────────
  function mondayOf(dateISO) {
    const d = new Date(dateISO + "T00:00:00"); const k = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - k); return d;
  }
  const isoDate = (d) => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
  function weekRange(offset = 0) {
    const mon = mondayOf(todayISO()); mon.setDate(mon.getDate() + 7 * offset);
    const next = new Date(mon); next.setDate(next.getDate() + 7);
    return { start: isoDate(mon), end: isoDate(next) };   // [start, end)
  }
  const inRange = (date, r) => date >= r.start && date < r.end;

  function weekSummary(offset = 0) {
    const r = weekRange(offset);
    const { sessions, prEvents } = replay();
    const mine = sessions.filter(s => inRange(s.workout.date, r));
    const improved = mine.reduce((a, s) => a + s.improved, 0);
    const compared = mine.reduce((a, s) => a + s.compared, 0);
    return {
      range: r, sessions: mine,
      workouts: mine.length,
      prs: prEvents.filter(p => inRange(p.date, r)).length,
      improved, compared, score: compared ? improved / compared : null,
      sets: mine.reduce((a, s) => a + workoutStats(s.workout).sets, 0),
      minutes: mine.reduce((a, s) => a + (durationMinutes(s.workout.startTime, s.workout.endTime) || workoutStats(s.workout).cardioMin), 0),
      cardioMin: mine.reduce((a, s) => a + workoutStats(s.workout).cardioMin, 0),
      cardioMi: mine.reduce((a, s) => a + workoutStats(s.workout).cardioMi, 0),
    };
  }

  // Volume per split per week (like-for-like), last N weeks
  function volumeBySplit(weeks = 8) {
    const out = {};   // template name → [{label, volume}]
    const labels = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const r = weekRange(-i);
      labels.push(isoWeek(r.start).label);
      const ws = completedWorkouts().filter(w => inRange(w.date, r));
      for (const w of ws) {
        const key = w.day || "Other";
        out[key] = out[key] || Array(weeks).fill(0);
        out[key][weeks - 1 - i] += workoutStats(w).volume;
      }
    }
    return { labels, series: out };
  }

  // Consistency over the last 4 weeks
  function consistency() {
    const r = { start: weekRange(-3).start, end: weekRange(0).end };
    const ws = completedWorkouts().filter(w => inRange(w.date, r));
    const bySplit = {};
    for (const w of ws) bySplit[w.day || "Other"] = (bySplit[w.day || "Other"] || 0) + 1;
    // streak: consecutive weeks (ending this week or last) with ≥1 workout
    let streak = 0;
    for (let i = 0; i < 52; i++) {
      const wr = weekRange(-i);
      const has = completedWorkouts().some(w => inRange(w.date, wr));
      if (has) streak++; else if (i === 0) continue; else break;
    }
    return { total: ws.length, bySplit, streak, perWeek: ws.length / 4 };
  }

  // ── Exercise progression (4-week trend) ────────────────────────────────
  function progression() {
    const { sessions } = replay();
    const cutoff = isoDate(new Date(Date.now() - 28 * 86400000));
    const byEx = new Map();
    for (const s of sessions) for (const it of s.items) {
      if (!byEx.has(it.exerciseId)) byEx.set(it.exerciseId, []);
      byEx.get(it.exerciseId).push({ date: s.workout.date, ...it });
    }
    const rows = [];
    for (const [id, hist] of byEx) {
      const last = hist[hist.length - 1];
      if (hist.length < 2) continue;
      const metric = last.type === "strength" ? "e1rm" : last.type === "bodyweight" ? (last.effE1rm ? "effE1rm" : "reps") : last.type === "timed" ? "seconds" : "distance";
      const recent = hist.filter(h => h.date >= cutoff);
      // Baseline: last session before the window if it's reasonably recent (≤12 wks old);
      // otherwise the first session inside the window; otherwise the previous session.
      const staleCutoff = isoDate(new Date(Date.now() - 84 * 86400000));
      const preWindow = hist.filter(h => h.date < cutoff).slice(-1)[0];
      let base = preWindow && preWindow.date >= staleCutoff ? preWindow
               : (recent.length >= 2 ? recent[0] : hist[hist.length - 2]);
      const now = last[metric] || 0, then = base?.[metric] || 0;
      const pct = then > 0 ? (now - then) / then : 0;
      const ups = recent.filter(h => h.status === "up").length, downs = recent.filter(h => h.status === "down").length;
      rows.push({ exerciseId: id, name: last.name, type: last.type, metric, now, then, pct, sessions: hist.length, recentSessions: recent.length, ups, downs, lastDate: last.date,
        trend: pct > 0.02 || ups > downs ? "up" : pct < -0.02 || downs > ups ? "down" : "flat" });
    }
    rows.sort((a, b) => b.lastDate.localeCompare(a.lastDate));
    return rows;
  }

  function exerciseHistory(exerciseId, limit = 8) {
    const { sessions } = replay();
    const rows = [];
    for (const s of sessions) for (const it of s.items) if (it.exerciseId === exerciseId) rows.push({ date: s.workout.date, day: s.workout.day, ...it });
    return rows.slice(-limit).reverse();
  }

  // ── Records ────────────────────────────────────────────────────────────
  function recordsTable() {
    const { prEvents, records } = replay();
    const latestByEx = new Map();
    for (const p of prEvents) {
      const r = latestByEx.get(p.exerciseId) || { name: p.name, exerciseId: p.exerciseId, last: p.date, prs: {} };
      r.prs[p.kind] = { value: p.value, date: p.date, load: p.load };
      if (p.date > r.last) r.last = p.date;
      latestByEx.set(p.exerciseId, r);
    }
    // Fill in absolute bests for exercises without PR *events* yet (single session)
    for (const [id, r] of records) {
      const ex = exById(id); if (!ex) continue;
      const row = latestByEx.get(id) || { name: ex.name, exerciseId: id, last: "", prs: {} };
      if (r.e1rm && !row.prs.e1rm) row.prs.e1rm = { value: r.e1rm };
      if (r.load && !row.prs.load) row.prs.load = { value: r.load };
      latestByEx.set(id, row);
    }
    return Array.from(latestByEx.values()).sort((a, b) => (b.prs.e1rm?.value || 0) - (a.prs.e1rm?.value || 0));
  }
  const recentPRs = (limit = 15) => replay().prEvents.slice().reverse().slice(0, limit);

  // ── Insights ───────────────────────────────────────────────────────────
  function median(arr) { const a = arr.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; }
  function dayBefore(iso) { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() - 1); return isoDate(d); }

  function sessionContexts() {
    const { sessions } = replay();
    const out = [];
    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      if (s.compared < 2) continue;                      // need something to compare
      const d = s.workout.date;
      const h = healthFor(d) || {};
      const nutPrev = effectiveNutrition(getNutritionFor(dayBefore(d)));
      const pGoal = proteinGoalFor(state.profile);
      const prevW = sessions[i - 1]?.workout;
      const restDays = prevW ? Math.round((Date.parse(d) - Date.parse(prevW.date)) / 86400000) - 1 : null;
      const startH = s.workout.startTime ? parseInt(s.workout.startTime.split(":")[0], 10) : null;
      const mins = durationMinutes(s.workout.startTime, s.workout.endTime) || null;
      out.push({
        session: s, date: d, score: s.score, prs: s.prs,
        sleep: h.sleepHours ?? null, hrv: h.hrv ?? null, rhr: h.restingHR ?? null,
        proteinHit: nutPrev.protein != null && pGoal ? nutPrev.protein >= pGoal : null,
        kcalPrev: nutPrev.kcal || null,
        restDays, startH, mins,
        watchAvgHR: s.workout.health?.avgHR ?? null,
      });
    }
    return out;
  }

  function insights() {
    const ctx = sessionContexts();
    const hrvMed = median(ctx.map(c => c.hrv)), rhrMed = median(ctx.map(c => c.rhr));
    const tests = [
      { key: "sleep",   label: "Sleep",          a: "7h+ sleep the night before",        b: "under 7h sleep",              pick: c => c.sleep == null ? null : c.sleep >= 7 },
      { key: "protein", label: "Protein",        a: "protein goal hit the day before",  b: "protein goal missed",         pick: c => c.proteinHit },
      { key: "hrv",     label: "HRV",            a: "HRV above your median",            b: "HRV below your median",       pick: c => c.hrv == null || hrvMed == null ? null : c.hrv >= hrvMed },
      { key: "rhr",     label: "Resting HR",     a: "resting HR at or below median",    b: "resting HR above median",     pick: c => c.rhr == null || rhrMed == null ? null : c.rhr <= rhrMed },
      { key: "time",    label: "Time of day",    a: "morning sessions (before noon)",   b: "afternoon / evening sessions", pick: c => c.startH == null ? null : c.startH < 12 },
      { key: "rest",    label: "Rest days",      a: "2+ rest days before",              b: "0–1 rest days before",        pick: c => c.restDays == null ? null : c.restDays >= 2 },
      { key: "length",  label: "Session length", a: "sessions under 60 min",            b: "sessions over 60 min",        pick: c => c.mins == null ? null : c.mins <= 60 },
    ];
    const results = [];
    for (const t of tests) {
      const A = [], B = [];
      for (const c of ctx) { const p = t.pick(c); if (p === true) A.push(c); else if (p === false) B.push(c); }
      const n = Math.min(A.length, B.length);
      const avg = arr => arr.length ? arr.reduce((s, c) => s + (c.score || 0), 0) / arr.length : null;
      const prRate = arr => arr.length ? arr.reduce((s, c) => s + c.prs, 0) / arr.length : null;
      const sA = avg(A), sB = avg(B);
      results.push({ ...t, nA: A.length, nB: B.length, scoreA: sA, scoreB: sB, prA: prRate(A), prB: prRate(B),
        ready: n >= 3, delta: sA != null && sB != null ? sA - sB : null, total: ctx.length });
    }
    // Strongest, ready insights first
    results.sort((x, y) => (y.ready - x.ready) || Math.abs(y.delta || 0) - Math.abs(x.delta || 0));
    const best = ctx.slice().sort((x, y) => (y.score || 0) - (x.score || 0) || y.prs - x.prs).slice(0, 5);
    return { results, best, sessions: ctx.length, withHealth: ctx.filter(c => c.sleep != null || c.hrv != null).length, withNutrition: ctx.filter(c => c.proteinHit != null).length };
  }

  return { replay, weekSummary, weekRange, volumeBySplit, consistency, progression, exerciseHistory, recordsTable, recentPRs, insights, sessionContexts, entrySummary };
})();
