import Foundation

/// Day-rollover rules for the streak snapshot, shared by the app and the widget
/// so both agree on what "today" means. Pure Foundation, no UI — compiled
/// standalone by the unit test in ios/tests/RolloverTests.swift.
///
/// The snapshot is written for a specific calendar day. Once midnight passes it
/// describes YESTERDAY, and rendering it as-is is what made the widget show a
/// stale step count and a stale streak. Every reader projects it forward first.
struct StreakCore {
    var date: String            // yyyy-MM-dd the numbers belong to
    var stepsToday: Int
    var goal: Int
    var streak: Int             // streakBase + (todayHit ? 1 : 0)
    var streakBase: Int         // completed-day run BEFORE `date`
    var todayHit: Bool
    var workoutsThisWeek: Int
    var weekHit: Bool
    var workoutGoal: Int
    var stale: Bool = false     // true when we can't verify the days in between
}

enum StreakRollover {
    static func dayFormatter() -> DateFormatter {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f
    }

    static func localDay(_ date: Date = Date()) -> String {
        dayFormatter().string(from: date)
    }

    static func parse(_ day: String) -> Date? {
        dayFormatter().date(from: day)
    }

    /// Whole days from `from` to `to` in the local calendar (negative if `to` is earlier).
    static func dayGap(from: String, to: String) -> Int? {
        guard let a = parse(from), let b = parse(to) else { return nil }
        return Calendar.current.dateComponents([.day], from: a, to: b).day
    }

    /// Same Monday-start week? Matches the app's own weekly workout window.
    static func sameWeek(_ a: String, _ b: String) -> Bool {
        guard let da = parse(a), let db = parse(b) else { return false }
        var cal = Calendar(identifier: .iso8601)
        cal.timeZone = .current
        let ca = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: da)
        let cb = cal.dateComponents([.yearForWeekOfYear, .weekOfYear], from: db)
        return ca.yearForWeekOfYear == cb.yearForWeekOfYear && ca.weekOfYear == cb.weekOfYear
    }

    /// Project a snapshot onto `today`.
    /// • same day  → unchanged
    /// • next day  → today starts at 0 steps and "pending"; yesterday, if it hit
    ///               the goal, becomes part of the completed run; if it missed,
    ///               the run is broken and resets to 0
    /// • older     → today starts at 0 and the carried run is marked `stale`,
    ///               because the days in between were never recorded (the app
    ///               recomputes the truth from history on next open)
    static func project(_ core: StreakCore, to today: String) -> StreakCore {
        if core.date == today { return core }
        var out = core
        out.date = today
        out.stepsToday = 0
        out.todayHit = false

        let gap = dayGap(from: core.date, to: today) ?? 99
        if gap == 1 {
            let base = core.todayHit ? core.streak : 0
            out.streakBase = base
            out.streak = base
            out.stale = false
        } else {
            // Unverifiable span — carry the last known run rather than wrongly
            // zeroing a real streak, but flag it so the UI can stay honest.
            out.streakBase = core.streak
            out.streak = core.streak
            out.stale = true
        }

        if !sameWeek(core.date, today) {
            out.workoutsThisWeek = 0
            out.weekHit = false
        }
        return out
    }
}

// MARK: - Snapshot dictionary bridge
// The app stores the snapshot as JSON in the App Group. Keeping the translation
// here (rather than inline in AppDelegate) means the exact code that runs on the
// phone is the code covered by ios/tests/RolloverTests.swift.
extension StreakRollover {
    static func core(from snap: [String: Any]) -> StreakCore {
        StreakCore(
            date: snap["date"] as? String ?? "",
            stepsToday: snap["stepsToday"] as? Int ?? 0,
            goal: snap["goal"] as? Int ?? 10000,
            streak: snap["streak"] as? Int ?? 0,
            streakBase: snap["streakBase"] as? Int
                ?? max(0, (snap["streak"] as? Int ?? 0) - ((snap["todayHit"] as? Bool ?? false) ? 1 : 0)),
            todayHit: snap["todayHit"] as? Bool ?? false,
            workoutsThisWeek: snap["workoutsThisWeek"] as? Int ?? 0,
            weekHit: snap["weekHit"] as? Bool ?? false,
            workoutGoal: snap["workoutGoal"] as? Int ?? 3)
    }

    static func apply(_ c: StreakCore, to snap: inout [String: Any]) {
        snap["date"] = c.date
        snap["stepsToday"] = c.stepsToday
        snap["todayHit"] = c.todayHit
        snap["streak"] = c.streak
        snap["streakBase"] = c.streakBase
        snap["workoutsThisWeek"] = c.workoutsThisWeek
        snap["weekHit"] = c.weekHit
        snap["stale"] = c.stale
    }

    /// Move a snapshot written on an earlier day onto `today`.
    /// Returns true when it changed (caller persists + refreshes the widget).
    @discardableResult
    static func rollSnapshot(_ snap: inout [String: Any], to today: String) -> Bool {
        guard let day = snap["date"] as? String, !day.isEmpty, day != today else { return false }
        apply(project(core(from: snap), to: today), to: &snap)
        return true
    }

    /// Force hit/streak to agree with the stored step count for the same day, so
    /// the snapshot can never claim "13,800 steps" and "goal not hit" at once.
    @discardableResult
    static func repairConsistency(_ snap: inout [String: Any], today: String) -> Bool {
        guard snap["date"] as? String == today else { return false }
        var c = core(from: snap)
        let hit = c.stepsToday >= c.goal
        let streak = c.streakBase + (hit ? 1 : 0)
        if c.todayHit == hit, c.streak == streak, snap["streakBase"] != nil { return false }
        c.todayHit = hit
        c.streak = streak
        apply(c, to: &snap)
        return true
    }
}
