/* Dashboard math for the Steps and Goals tabs: pure functions over plain data, no DOM and no app
   state, so scripts/test-dash.mjs can check them in Node. Loaded before app.js.

   Days are "YYYY-MM-DD" strings and every calculation is done in UTC, so a daylight-saving change
   can never move a day. Weeks run Monday to Sunday. A day with no count is "no data", never zero,
   and nothing before the first counted day is shown. */
const DashMath = (() => {
  const MS = 86400000;
  const ms = (d) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const add = (d, n) => iso(ms(d) + n * MS);
  const between = (a, b) => Math.round((ms(b) - ms(a)) / MS);
  const weekday = (d) => (new Date(ms(d)).getUTCDay() + 6) % 7;        // Monday = 0
  const weekStart = (d) => add(d, -weekday(d));
  const monthStart = (d) => d.slice(0, 8) + "01";
  const keysOf = (src) => src instanceof Map ? [...src.keys()] : Object.keys(src || {});
  const valueOf = (src, d) => src instanceof Map ? src.get(d) : src?.[d];

  // Every day from the first counted one through today. `src` maps a date to its count (a Map or an
  // object); a count of zero is the same as none. `back` is how many days of history are kept.
  function series(src, today, back = 400) {
    const oldest = add(today, 1 - back);
    let first = null;
    for (const d of keysOf(src)) {
      if (d > today || d < oldest || !(valueOf(src, d) > 0)) continue;
      if (first === null || d < first) first = d;
    }
    if (first === null) return { first: null, list: [] };
    const list = [];
    for (let d = first; d <= today; d = add(d, 1)) list.push({ date: d, n: Math.max(0, Math.round(valueOf(src, d) || 0)) });
    return { first, list };
  }

  // The days from `from` through `to`, a zero where nothing was counted. For goals, whose dates are
  // set by hand, where a quiet day is a real zero.
  function range(src, from, to) {
    const out = [];
    for (let d = from, i = 0; d <= to && i < 800; d = add(d, 1), i++) out.push({ date: d, n: Math.max(0, Math.round(valueOf(src, d) || 0)) });
    return out;
  }

  // The figures behind the top panel and the records, from a series.
  function stats(list, goal, today) {
    const out = {
      first: list[0]?.date || null, count: 0, elapsed: list.length, total: 0, avg: 0, todayN: 0,
      week: 0, month: 0, hit: 0,
      best: { n: 0, date: "" }, bestWeek: { n: 0, start: "", end: "" }, weekdayAvg: Array(7).fill(null),
    };
    if (!list.length) return out;
    const thisWeek = weekStart(today), thisMonth = monthStart(today);
    const dowSum = Array(7).fill(0), dowDays = Array(7).fill(0), weeks = new Map();
    for (const { date, n } of list) {
      if (date === today) out.todayN = n;
      if (date >= thisWeek) out.week += n;
      if (date >= thisMonth) out.month += n;
      const w = weekStart(date);
      weeks.set(w, (weeks.get(w) || 0) + n);
      if (!(n > 0)) continue;
      out.count++;
      out.total += n;
      if (goal > 0 && n >= goal) out.hit++;
      if (n > out.best.n || (n === out.best.n && date > out.best.date)) out.best = { n, date };
      dowSum[weekday(date)] += n;
      dowDays[weekday(date)]++;
    }
    out.avg = out.count ? out.total / out.count : 0;
    out.weekdayAvg = dowDays.map((c, i) => c ? dowSum[i] / c : null);
    for (const [start, n] of weeks) {
      if (n > out.bestWeek.n || (n === out.bestWeek.n && start > out.bestWeek.start)) {
        const end = add(start, 6);
        out.bestWeek = { n, start, end: end > today ? today : end };
      }
    }
    return out;
  }

  // The mean of the counted days among the `span` days ending at each day; null where there are none.
  function rolling(list, span = 7) {
    return list.map((_, i) => {
      let sum = 0, days = 0;
      for (let j = Math.max(0, i - span + 1); j <= i; j++) if (list[j].n > 0) { sum += list[j].n; days++; }
      return days ? sum / days : null;
    });
  }

  // Five shades relative to the daily goal; 0 is a day with nothing counted.
  function level(n, goal) {
    if (!(n > 0)) return 0;
    const f = goal > 0 ? n / goal : 1;
    return f >= 1 ? 5 : f >= 0.75 ? 4 : f >= 0.5 ? 3 : f >= 0.25 ? 2 : 1;
  }

  // Weekly columns, Monday to Sunday, from the week counting began; once there are more than
  // `maxWeeks` of them the oldest roll off. A day is { date, n, future, before } where `before`
  // marks days ahead of the first count.
  function grid(list, today, maxWeeks = 26) {
    if (!list.length) return { weeks: [] };
    const counts = new Map(list.map(x => [x.date, x.n]));
    const first = list[0].date, last = weekStart(today);
    let from = weekStart(first);
    if (between(from, last) / 7 + 1 > maxWeeks) from = add(last, -(maxWeeks - 1) * 7);
    const weeks = [];
    for (let w = from; w <= last; w = add(w, 7)) {
      const days = [];
      for (let i = 0; i < 7; i++) {
        const d = add(w, i);
        days.push({ date: d, n: counts.get(d) || 0, future: d > today, before: d < first });
      }
      weeks.push({ start: w, days });
    }
    return { weeks };
  }

  // The longest stretch of consecutive true flags (oldest first): { len, start, end } as indexes.
  function runs(flags) {
    let best = { len: 0, start: -1, end: -1 }, at = -1;
    flags.forEach((on, i) => {
      if (!on) { at = -1; return; }
      if (at < 0) at = i;
      if (i - at + 1 > best.len) best = { len: i - at + 1, start: at, end: i };
    });
    return best;
  }

  // A top for the chart's scale that is a round number, and tick marks that divide it evenly.
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p;
    return (m <= 1 ? 1 : m <= 1.2 ? 1.2 : m <= 1.5 ? 1.5 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 3 ? 3 : m <= 4 ? 4 : m <= 5 ? 5 : m <= 6 ? 6 : m <= 8 ? 8 : 10) * p;
  }
  function ticks(max) {
    if (!(max > 0)) return [];
    const raw = max / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p, out = [];
    for (let v = step; v <= max * 1.0001; v += step) out.push(Math.round(v));
    return out;
  }
  // 12,400 -> "12.4k", 500 -> "500"
  const abbr = (n) => n >= 1000 ? `${Math.round(n / 100) / 10}k`.replace(".0k", "k") : String(Math.round(n));

  return { add, between, weekday, weekStart, monthStart, series, range, stats, rolling, level, grid, runs, niceMax, ticks, abbr };
})();

if (typeof module !== "undefined" && module.exports) module.exports = DashMath;
