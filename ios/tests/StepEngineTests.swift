import Foundation

var failures = 0
func check<T: Equatable>(_ label: String, _ got: T, _ want: T) {
    if got == want { print("  ok   \(label)") }
    else { print("  FAIL \(label): got \(got), want \(want)"); failures += 1 }
}
func day(_ s: StepSummary, _ key: String) -> StepDay? { s.last14.first { $0.date == key } }

let denver = StepEngine.calendar(timeZone: TimeZone(identifier: "America/Denver")!)
let la = StepEngine.calendar(timeZone: TimeZone(identifier: "America/Los_Angeles")!)
let jacob = StepSettings(goal: 10000, calApple: 7600, calActual: 10000, workoutGoal: 4)

print("\n1) day math, including daylight-saving changes")
check("add a day", StepEngine.addDays("2026-09-15", 1, denver), Optional("2026-09-16"))
check("spring forward", StepEngine.addDays("2026-03-08", 1, denver), Optional("2026-03-09"))
check("fall back", StepEngine.daysBetween("2026-10-31", "2026-11-02", denver), Optional(2))
check("across the year", StepEngine.addDays("2026-12-31", 1, denver), Optional("2027-01-01"))
check("Wed → its Monday", StepEngine.weekStart("2026-09-16", denver), Optional("2026-09-14"))
check("Sun → previous Monday", StepEngine.weekStart("2026-09-13", denver), Optional("2026-09-07"))
check("Mon → itself", StepEngine.weekStart("2026-09-14", denver), Optional("2026-09-14"))

print("\n2) a total is keyed by the day it measured, one calendar per read")
let bucket = StepEngine.startOfDay("2026-09-16", denver)!
check("Denver bucket keys to its own day", StepEngine.dayKey(bucket, denver), "2026-09-16")
check("the same instant is still Sep 15 in LA", StepEngine.dayKey(bucket, la), "2026-09-15")

print("\n3) today's count never comes from another day (the 8,077 bug)")
let s3 = StepEngine.compute(today: "2026-09-16", counts: ["2026-09-15": 8077, "2026-09-16": 60],
                            peaks: [:], settings: jacob, computedAt: 0, denver)
check("today raw", s3.todayRaw, 60)
check("today calibrated", s3.todaySteps, 79)
check("goal not met", s3.goalMet, false)
check("yesterday keeps its own total", day(s3, "2026-09-15")?.raw, Optional(8077))

print("\n4) a goal you reached isn't taken back by a later, lower Health total")
let peaks4 = StepEngine.mergePeaks([:], with: ["2026-09-10": 7650], today: "2026-09-10", denver)
let s4 = StepEngine.compute(today: "2026-09-11", counts: ["2026-09-10": 7340, "2026-09-11": 200],
                            peaks: peaks4, settings: jacob, computedAt: 0, denver)
check("Sep 10 still hit", day(s4, "2026-09-10")?.hit, Optional(true))
check("streak base counts Sep 10", s4.streakBase, 1)

print("\n5) peaks: highs kept per day, zeros ignored, old days pruned")
var p5 = StepEngine.mergePeaks([:], with: ["2026-09-16": 7650], today: "2026-09-16", denver)
p5 = StepEngine.mergePeaks(p5, with: ["2026-09-16": 7340, "2026-09-15": 0], today: "2026-09-16", denver)
check("keeps the high", p5["2026-09-16"], Optional(7650))
check("zero ignored", p5["2026-09-15"], Optional<Int>.none)
p5["2025-01-01"] = 9000
p5 = StepEngine.mergePeaks(p5, with: [:], today: "2026-09-16", denver)
check("older than 400 days pruned", p5["2025-01-01"], Optional<Int>.none)

print("\n6) weekly pace: the next morning doesn't un-cover a day the week covered")
var c6: [String: Int] = [:]
for d in ["2026-08-31","2026-09-01","2026-09-02","2026-09-03","2026-09-04","2026-09-05",
          "2026-09-06","2026-09-07","2026-09-08","2026-09-09"] { c6[d] = 8000 }
c6["2026-09-10"] = 7340
let thuNight = StepEngine.compute(today: "2026-09-10", counts: c6, peaks: [:], settings: jacob, computedAt: 0, denver)
c6["2026-09-11"] = 150
let friMorning = StepEngine.compute(today: "2026-09-11", counts: c6, peaks: [:], settings: jacob, computedAt: 0, denver)
check("Thursday night: today covered", thuNight.todayCounts, true)
check("Thursday night streak", thuNight.streak, 11)
check("Friday morning: Thursday still covered", day(friMorning, "2026-09-10")?.counts, Optional(true))
check("Friday morning: streak intact", friMorning.streakBase, 11)
check("Friday morning: today pending", friMorning.todayCounts, false)

print("\n7) a real miss breaks the streak; a big day can restore the week")
let s7 = StepEngine.compute(today: "2026-09-16", counts: ["2026-09-14": 8000, "2026-09-15": 3000, "2026-09-16": 1000],
                            peaks: [:], settings: jacob, computedAt: 0, denver)
check("Tuesday not covered", day(s7, "2026-09-15")?.counts, Optional(false))
check("streak broken", s7.streak, 0)
let s7b = StepEngine.compute(today: "2026-09-16", counts: ["2026-09-14": 8000, "2026-09-15": 3000, "2026-09-16": 12000],
                             peaks: [:], settings: jacob, computedAt: 0, denver)
check("Tuesday covered once the week is at pace", day(s7b, "2026-09-15")?.rescued, Optional(true))
check("streak 3", s7b.streak, 3)

print("\n8) carrying a summary forward without a read (phone locked)")
let base8 = StepEngine.compute(today: "2026-09-15", counts: ["2026-09-14": 8000, "2026-09-15": 8077],
                               peaks: [:], settings: jacob, computedAt: 0, denver)
let p8 = StepEngine.project(base8, to: "2026-09-16", settings: jacob, denver)
check("date moves", p8.date, "2026-09-16")
check("today starts empty", p8.todaySteps, 0)
check("streak carries a counted yesterday", p8.streak, base8.streak)
check("strip ends today", p8.last14.last?.date, Optional("2026-09-16"))
check("same day unchanged", StepEngine.project(base8, to: "2026-09-15", settings: jacob, denver), base8)
var pending8 = base8
pending8.todayCounts = false
pending8.streak = pending8.streakBase
check("unfinished yesterday: neither credited nor broken",
      StepEngine.project(pending8, to: "2026-09-16", settings: jacob, denver).streak, pending8.streakBase)
let week8 = StepEngine.project(base8, to: "2026-09-21", settings: StepSettings(workoutDates: ["2026-09-15", "2026-09-21"]), denver)
check("new week resets the total", week8.weekTotal, 0)
check("workouts counted for the new week", week8.workoutsThisWeek, 1)

print("\n9) calibration")
check("no pair → ×1", StepSettings().calibration, 1.0)
check("7600 → 10000", (jacob.calibration * 10000).rounded() / 10000, 1.3158)
check("clamped high", StepSettings(calApple: 1000, calActual: 9000).calibration, 3.0)

print("\n10) workouts this week (Monday start)")
let s10 = StepEngine.compute(today: "2026-09-16", counts: [:], peaks: [:],
                             settings: StepSettings(workoutDates: ["2026-09-13", "2026-09-14", "2026-09-14", "2026-09-16", "2026-09-17"]),
                             computedAt: 0, denver)
check("Mon–today only, each session counts", s10.workoutsThisWeek, 3)

print(failures == 0 ? "\nALL PASS" : "\n\(failures) FAILURES")
exit(failures == 0 ? 0 : 1)
