#!/usr/bin/env node
// Checks the dashboard math in dash.js: node scripts/test-dash.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const D = createRequire(import.meta.url)("../dash.js");

let n = 0;
const test = (name, fn) => { fn(); n++; console.log("ok  " + name); };

const TODAY = "2026-11-21";                      // a Saturday; its week began Monday Nov 16

test("dates: Monday-first weeks, month starts, no daylight-saving drift", () => {
  assert.equal(D.weekday("2026-11-16"), 0);
  assert.equal(D.weekday(TODAY), 5);
  assert.equal(D.weekStart(TODAY), "2026-11-16");
  assert.equal(D.weekStart("2026-11-22"), "2026-11-16");   // Sunday belongs to the week before Monday
  assert.equal(D.monthStart(TODAY), "2026-11-01");
  for (const [a, b] of [["2026-03-07", "2026-03-09"], ["2026-10-31", "2026-11-02"]]) {   // US clocks changed on 03-08 and 11-01
    assert.equal(D.between(a, b), 2);
    assert.equal(D.add(D.add(a, 1), 1), b);
  }
  assert.equal(D.add("2026-12-31", 1), "2027-01-01");
  assert.equal(D.add("2028-02-28", 1), "2028-02-29");
});

test("series: starts on the first counted day, leaves gaps as zero counts, ignores zero and the future", () => {
  const src = { "2026-11-10": 5000, "2026-11-12": 8000, "2026-11-13": 0, "2026-11-21": 9000, "2026-11-25": 99999, "2026-01-01": 0 };
  const { first, list } = D.series(src, TODAY);
  assert.equal(first, "2026-11-10");
  assert.equal(list.length, 12);
  assert.equal(list[0].n, 5000);
  assert.equal(list[1].n, 0);                    // Nov 11 has no data
  assert.equal(list.at(-1).date, TODAY);
  assert.equal(list.at(-1).n, 9000);
  assert.deepEqual(D.series({}, TODAY), { first: null, list: [] });
  assert.deepEqual(D.series({ [TODAY]: 0 }, TODAY), { first: null, list: [] });
  const m = D.series(new Map([["2026-11-20", 7]]), TODAY);   // a Map works the same
  assert.equal(m.list.length, 2);
});

test("series: only `back` days of history are kept", () => {
  const src = { "2026-11-01": 100, "2026-11-20": 100 };
  assert.equal(D.series(src, TODAY, 21).first, "2026-11-01");
  assert.equal(D.series(src, TODAY, 20).first, "2026-11-20");
});

test("stats: week, month, total, average of counted days, days at goal", () => {
  // Oct 30 (Fri), Nov 1 (Sun), Nov 2 (Mon) ... Nov 16 (Mon), Nov 17, Nov 21 (Sat)
  const src = { "2026-10-30": 12000, "2026-11-01": 4000, "2026-11-02": 10000, "2026-11-16": 11000, "2026-11-17": 3000, "2026-11-21": 10500 };
  const { list } = D.series(src, TODAY);
  const s = D.stats(list, 10000, TODAY);
  assert.equal(s.first, "2026-10-30");
  assert.equal(s.elapsed, 23);
  assert.equal(s.count, 6);
  assert.equal(s.total, 50500);
  assert.equal(Math.round(s.avg), 8417);          // 50,500 / 6 counted days, not / 23 elapsed
  assert.equal(s.todayN, 10500);
  assert.equal(s.week, 24500);                    // Nov 16 + 17 + 21
  assert.equal(s.month, 38500);                   // Nov 1 + 2 + 16 + 17 + 21 (4,000 + 10,000 + 11,000 + 3,000 + 10,500)
  assert.equal(s.hit, 4);                         // 12,000, 10,000 (equal counts), 11,000, 10,500
  assert.deepEqual(s.best, { n: 12000, date: "2026-10-30" });
});

test("stats: best week is Monday to Sunday, the current week stops at today, ties go to the later week", () => {
  const src = { "2026-11-02": 20000, "2026-11-08": 5000, "2026-11-16": 25000 };      // week of Nov 2: 25,000 (Mon + Sun); week of Nov 16: 25,000
  const { list } = D.series(src, TODAY);
  const s = D.stats(list, 10000, TODAY);
  assert.deepEqual(s.bestWeek, { n: 25000, start: "2026-11-16", end: TODAY });
  const past = D.stats(D.series({ "2026-11-02": 20000, "2026-11-08": 5000, "2026-11-16": 1000 }, TODAY).list, 10000, TODAY);
  assert.deepEqual(past.bestWeek, { n: 25000, start: "2026-11-02", end: "2026-11-08" });
});

test("stats: weekday averages use only the days counted on that weekday", () => {
  const src = { "2026-11-02": 10000, "2026-11-09": 20000, "2026-11-03": 6000 };      // two Mondays, one Tuesday
  const s = D.stats(D.series(src, TODAY).list, 10000, TODAY);
  assert.equal(s.weekdayAvg[0], 15000);
  assert.equal(s.weekdayAvg[1], 6000);
  assert.equal(s.weekdayAvg[2], null);
});

test("stats: empty series and a zero goal do not break", () => {
  const e = D.stats([], 10000, TODAY);
  assert.equal(e.count, 0); assert.equal(e.first, null); assert.equal(e.avg, 0);
  const z = D.stats(D.series({ [TODAY]: 500 }, TODAY).list, 0, TODAY);
  assert.equal(z.hit, 0);
});

test("rolling: mean of counted days in the window, null before anything is counted", () => {
  const list = [{ n: 100 }, { n: 0 }, { n: 300 }, { n: 500 }].map((x, i) => ({ date: D.add("2026-11-01", i), n: x.n }));
  assert.deepEqual(D.rolling(list, 3), [100, 100, 200, 400]);
  assert.deepEqual(D.rolling([{ date: "2026-11-01", n: 0 }], 7), [null]);
});

test("level: five shades relative to the goal", () => {
  assert.deepEqual([0, 1, 2499, 2500, 4999, 5000, 7499, 7500, 9999, 10000, 25000].map(v => D.level(v, 10000)), [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.equal(D.level(100, 0), 5);
});

test("grid: columns are weeks from the week counting began, future days are marked", () => {
  const src = { "2026-11-11": 5000, "2026-11-21": 9000 };                            // Wed Nov 11 .. Sat Nov 21
  const g = D.grid(D.series(src, TODAY).list, TODAY);
  assert.equal(g.weeks.length, 2);
  assert.equal(g.weeks[0].start, "2026-11-09");
  assert.equal(g.weeks[0].days[0].before, true);                                    // Mon Nov 9 is before the first count
  assert.equal(g.weeks[0].days[2].before, false);
  assert.equal(g.weeks[0].days[2].n, 5000);
  assert.equal(g.weeks[1].days[5].n, 9000);
  assert.equal(g.weeks[1].days[6].future, true);                                    // Sunday Nov 22 has not happened
  assert.equal(g.weeks[1].days[5].future, false);
  assert.deepEqual(D.grid([], TODAY), { weeks: [] });
});

test("grid: after 26 weeks the oldest roll off", () => {
  const src = { "2025-01-06": 1000, [TODAY]: 1000 };
  const g = D.grid(D.series(src, TODAY, 700).list, TODAY, 26);       // Jan 6 2025 is 684 days back
  assert.equal(g.weeks.length, 26);
  assert.equal(g.weeks.at(-1).start, "2026-11-16");
  assert.equal(g.weeks[0].start, "2026-05-25");
  assert.equal(g.weeks.every(w => w.days.every(d => d.before === false)), true);
});

test("runs: the longest stretch of consecutive days", () => {
  assert.deepEqual(D.runs([false, true, true, false, true, true, true, false]), { len: 3, start: 4, end: 6 });
  assert.deepEqual(D.runs([true, true]), { len: 2, start: 0, end: 1 });
  assert.deepEqual(D.runs([false, false]), { len: 0, start: -1, end: -1 });
  assert.deepEqual(D.runs([]), { len: 0, start: -1, end: -1 });
  assert.equal(D.runs([true, false, true]).len, 1);
});

test("scale: round tops and tick marks", () => {
  assert.equal(D.niceMax(18000), 20000);
  assert.equal(D.niceMax(11500), 12000);
  assert.equal(D.niceMax(13396), 15000);
  assert.equal(D.niceMax(10400), 12000);
  assert.equal(D.niceMax(22000), 25000);
  assert.equal(D.niceMax(10000), 10000);
  assert.equal(D.niceMax(7300), 8000);
  assert.equal(D.niceMax(0), 1);
  assert.deepEqual(D.ticks(20000), [5000, 10000, 15000, 20000]);
  assert.deepEqual(D.ticks(15000), [5000, 10000, 15000]);
  assert.deepEqual(D.ticks(8000), [2000, 4000, 6000, 8000]);
  assert.deepEqual(D.ticks(12000), [5000, 10000]);
  assert.deepEqual(D.ticks(25000), [10000, 20000]);
  assert.deepEqual(D.ticks(0), []);
  assert.deepEqual([500, 1000, 2500, 12400, 20000].map(D.abbr), ["500", "1k", "2.5k", "12.4k", "20k"]);
});

test("range: a real zero for every quiet day between two dates", () => {
  const r = D.range({ "2026-11-02": 5, "2026-11-04": 7 }, "2026-11-01", "2026-11-05");
  assert.deepEqual(r.map(x => x.n), [0, 5, 0, 7, 0]);
  assert.deepEqual(D.range({}, "2026-11-05", "2026-11-01"), []);
});

console.log(`\n${n} checks passed`);
