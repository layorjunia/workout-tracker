import Foundation

var failures = 0
func check(_ label: String, _ got: Any, _ want: Any) {
    let g = String(describing: got), w = String(describing: want)
    if g == w { print("  ok   \(label): \(g)") }
    else { print("  FAIL \(label): got \(g), want \(w)"); failures += 1 }
}

let cal = Calendar.current
let today = StreakRollover.localDay()
let yesterday = StreakRollover.localDay(cal.date(byAdding: .day, value: -1, to: Date())!)
let fourDaysAgo = StreakRollover.localDay(cal.date(byAdding: .day, value: -4, to: Date())!)

// Jacob's exact report: yesterday hit the goal, app not opened, widget shows day 3.
print("\n1) yesterday HIT → today pending, yesterday joins the run")
let hitYesterday = StreakCore(date: yesterday, stepsToday: 12480, goal: 10000,
                              streak: 3, streakBase: 2, todayHit: true,
                              workoutsThisWeek: 2, weekHit: false, workoutGoal: 3)
let r1 = StreakRollover.project(hitYesterday, to: today)
check("date", r1.date, today)
check("steps reset", r1.stepsToday, 0)
check("today pending", r1.todayHit, false)
check("streak carries yesterday", r1.streak, 3)
check("base for today", r1.streakBase, 3)
check("not stale", r1.stale, false)

print("\n2) yesterday MISSED → run resets")
var missed = hitYesterday
missed.todayHit = false; missed.streak = 2
let r2 = StreakRollover.project(missed, to: today)
check("streak broken", r2.streak, 0)
check("base", r2.streakBase, 0)

print("\n3) same day → untouched")
var sameDay = hitYesterday; sameDay.date = today
let r3 = StreakRollover.project(sameDay, to: today)
check("steps kept", r3.stepsToday, 12480)
check("hit kept", r3.todayHit, true)
check("streak kept", r3.streak, 3)

print("\n4) 4 days stale → steps reset, run carried but flagged")
var old = hitYesterday; old.date = fourDaysAgo
let r4 = StreakRollover.project(old, to: today)
check("steps reset", r4.stepsToday, 0)
check("streak carried", r4.streak, 3)
check("flagged stale", r4.stale, true)

print("\n5) weekly workout count resets only across a week boundary")
check("same week keeps count",
      StreakRollover.project(hitYesterday, to: today).workoutsThisWeek,
      StreakRollover.sameWeek(yesterday, today) ? 2 : 0)
let mondayCase = StreakCore(date: "2026-08-30", stepsToday: 9000, goal: 10000,   // Sunday
                            streak: 4, streakBase: 4, todayHit: false,
                            workoutsThisWeek: 3, weekHit: true, workoutGoal: 3)
let r5 = StreakRollover.project(mondayCase, to: "2026-08-31")                     // Monday
check("new week resets workouts", r5.workoutsThisWeek, 0)
check("new week clears weekHit", r5.weekHit, false)
let r5b = StreakRollover.project(mondayCase, to: "2026-08-30")
check("same-day no reset", r5b.workoutsThisWeek, 3)


print("\n6) dictionary bridge — the exact code path the app runs")
var snap: [String: Any] = ["date": yesterday, "stepsToday": 12480, "goal": 10000,
                           "streak": 3, "streakBase": 2, "todayHit": true,
                           "workoutsThisWeek": 2, "weekHit": false, "workoutGoal": 3]
check("rollSnapshot reports change", StreakRollover.rollSnapshot(&snap, to: today), true)
check("date", snap["date"] as? String ?? "", today)
check("steps reset", snap["stepsToday"] as? Int ?? -1, 0)
check("streak carries", snap["streak"] as? Int ?? -1, 3)
check("base", snap["streakBase"] as? Int ?? -1, 3)
check("second roll is a no-op", StreakRollover.rollSnapshot(&snap, to: today), false)

print("\n7) consistency repair — the 13.8k-steps-but-not-hit contradiction")
var bad: [String: Any] = ["date": today, "stepsToday": 13800, "goal": 10000,
                          "streak": 5, "streakBase": 5, "todayHit": false,
                          "workoutsThisWeek": 1, "weekHit": false, "workoutGoal": 3]
check("repair reports change", StreakRollover.repairConsistency(&bad, today: today), true)
check("hit corrected", bad["todayHit"] as? Bool ?? false, true)
check("streak includes today", bad["streak"] as? Int ?? -1, 6)
check("repair is idempotent", StreakRollover.repairConsistency(&bad, today: today), false)

print("\n8) a snapshot with no date is left alone (nothing to roll)")
var undated: [String: Any] = ["stepsToday": 500, "goal": 10000, "streak": 0]
check("no roll", StreakRollover.rollSnapshot(&undated, to: today), false)

print("\n9) week-pace verdict survives a native consistency repair")
var rescued: [String: Any] = ["date": today, "stepsToday": 9658, "goal": 10000,
                              "streak": 11, "streakBase": 10, "todayHit": true, "weekRescued": true,
                              "workoutsThisWeek": 2, "weekHit": false, "workoutGoal": 4]
check("no change needed", StreakRollover.repairConsistency(&rescued, today: today), false)
check("today still counts", rescued["todayHit"] as? Bool ?? false, true)
check("streak intact", rescued["streak"] as? Int ?? -1, 11)

print("\n10) a covered yesterday carries overnight; the verdict resets for the new day")
var carried: [String: Any] = ["date": yesterday, "stepsToday": 9658, "goal": 10000,
                              "streak": 11, "streakBase": 10, "todayHit": true, "weekRescued": true,
                              "workoutsThisWeek": 2, "weekHit": false, "workoutGoal": 4]
StreakRollover.rollSnapshot(&carried, to: today)
check("streak carried", carried["streak"] as? Int ?? -1, 11)
check("today pending", carried["todayHit"] as? Bool ?? true, false)
check("verdict reset", carried["weekRescued"] as? Bool ?? true, false)

print("\n11) without the verdict, a day under goal doesn't count")
var plain: [String: Any] = ["date": today, "stepsToday": 9658, "goal": 10000,
                            "streak": 11, "streakBase": 10, "todayHit": true,
                            "workoutsThisWeek": 2, "weekHit": false, "workoutGoal": 4]
check("repair corrects it", StreakRollover.repairConsistency(&plain, today: today), true)
check("today not hit", plain["todayHit"] as? Bool ?? true, false)
check("streak = base", plain["streak"] as? Int ?? -1, 10)

print("\n12) step peaks: a lower later reading never erases the day's high")
var peaks: [String: Int] = [:]
StreakRollover.recordPeak(&peaks, day: today, raw: 7650)
StreakRollover.recordPeak(&peaks, day: today, raw: 7340)
check("keeps the 11:30pm high", peaks[today] ?? -1, 7650)
StreakRollover.recordPeak(&peaks, day: today, raw: 0)
check("ignores a zero read", peaks[today] ?? -1, 7650)
StreakRollover.recordPeak(&peaks, day: today, raw: 7700)
check("rises with a higher reading", peaks[today] ?? -1, 7700)
let twelveDaysAgo = StreakRollover.localDay(cal.date(byAdding: .day, value: -12, to: Date())!)
peaks[twelveDaysAgo] = 9000
StreakRollover.recordPeak(&peaks, day: today, raw: 7700)
check("prunes days older than 10", peaks[twelveDaysAgo] == nil, true)

print("\n13) widget refresh: a streak change always lands; nothing gets lost")
let snapA: [String: Any] = ["date": today, "stepsToday": 7650, "todayHit": false, "streak": 0,
                            "workoutsThisWeek": 2, "weekHit": false, "goal": 10000]
var snapB = snapA; snapB["streak"] = 2
var snapC = snapA; snapC["stepsToday"] = 8000
let bA = StreakRollover.widgetBucket(snapA), bB = StreakRollover.widgetBucket(snapB), bC = StreakRollover.widgetBucket(snapC)
check("unchanged → no refresh", StreakRollover.shouldReloadWidget(lastBucket: bA, newBucket: bA, lastReload: 0, now: 1000, foreground: true), false)
check("app open, streak changed right after a refresh → refresh", StreakRollover.shouldReloadWidget(lastBucket: bA, newBucket: bB, lastReload: 999, now: 1000, foreground: true), true)
check("background, streak changed → refresh now", StreakRollover.shouldReloadWidget(lastBucket: bA, newBucket: bB, lastReload: 999, now: 1000, foreground: false), true)
check("background, steps only, within 4 min → waits", StreakRollover.shouldReloadWidget(lastBucket: bA, newBucket: bC, lastReload: 900, now: 1000, foreground: false), false)
check("…and still lands on the next write after 4 min", StreakRollover.shouldReloadWidget(lastBucket: bA, newBucket: bC, lastReload: 700, now: 1000, foreground: false), true)
check("first refresh ever", StreakRollover.shouldReloadWidget(lastBucket: nil, newBucket: bA, lastReload: 0, now: 1, foreground: false), true)

print(failures == 0 ? "\nALL PASS" : "\n\(failures) FAILURES")
exit(failures == 0 ? 0 : 1)
