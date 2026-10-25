import Foundation

/// Step goal and streak rules, shared by the app, the widget, and the background
/// refresh. Pure Foundation (no HealthKit, no UI) so it runs standalone under
/// ios/tests/StepEngineTests.swift.
///
/// Every step total arrives keyed by the calendar day HealthKit measured it over.
/// Nothing here decides which day a number belongs to after the fact.

struct StepSettings: Codable, Equatable {
    var goal: Int = 10000
    var calApple: Double? = nil      // what Health reads…
    var calActual: Double? = nil     // …against a measured actual
    var workoutGoal: Int = 4
    var reminderEnabled: Bool = false
    var reminderHour: Int = 19
    var workoutDates: [String] = []  // one entry per qualifying session
    var longGoal: LongGoalPlan? = nil

    var calibration: Double {
        guard let a = calApple, let b = calActual, a > 0, b > 0 else { return 1 }
        return min(3, max(0.5, b / a))
    }
}

/// A step total to reach between two dates, both inclusive.
struct LongGoalPlan: Codable, Equatable {
    var target: Int
    var start: String
    var end: String
}

struct LongGoalProgress: Codable, Equatable {
    enum Phase: String, Codable { case upcoming, active, reached, ended }
    var target: Int
    var start: String
    var end: String
    var phase: Phase
    var total: Int          // steps counted from the start through today
    var percent: Double     // total / target; 1 = done
    var perDay: Int         // what each remaining day needs to finish on time
    var daysLeft: Int       // today included; 0 once the end date has passed
    var totalDays: Int
    var startsIn: Int       // days until the start; 0 once begun

    /// What each day needed on day one: the plan's even daily average.
    var planPerDay: Int { Int((Double(target) / Double(max(1, totalDays))).rounded(.up)) }
    /// How far the daily need has dropped below that average; negative = it has risen.
    var loweredBy: Int { phase == .active ? planPerDay - perDay : 0 }
}

struct StepDay: Codable, Equatable {
    var date: String
    var raw: Int        // Health's current total for the day
    var peak: Int       // highest total Health has reported for the day
    var steps: Int      // calibrated max(raw, peak)
    var hasData: Bool
    var hit: Bool       // reached the goal
    var rescued: Bool   // under the goal, but the week was at pace
    var counts: Bool    // hit or rescued
}

struct StepSummary: Codable, Equatable {
    var date: String
    var todayRaw: Int
    var todaySteps: Int
    var goal: Int
    var goalMet: Bool
    var todayCounts: Bool
    var streak: Int
    var streakBase: Int      // consecutive counting days before today
    var weekTotal: Int
    var weekTarget: Int      // goal × (finished days this week + today)
    var weekFullTarget: Int
    var weekOnPace: Bool
    var workoutsThisWeek: Int
    var workoutGoal: Int
    var last14: [StepDay]
    var computedAt: Double
    var longGoal: LongGoalProgress? = nil
}

enum StepEngine {
    static let lookbackDays = 400

    // MARK: Calendar

    /// Gregorian, Monday-first, frozen to one time zone. A read and its
    /// computation share one instance so a day boundary can't move mid-pass.
    static func calendar(timeZone: TimeZone? = nil) -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.locale = Locale(identifier: "en_US_POSIX")
        c.timeZone = timeZone
            ?? TimeZone(identifier: TimeZone.autoupdatingCurrent.identifier)
            ?? TimeZone.autoupdatingCurrent
        c.firstWeekday = 2
        return c
    }

    static func dayKey(_ date: Date, _ cal: Calendar) -> String {
        let c = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func startOfDay(_ key: String, _ cal: Calendar) -> Date? {
        let p = key.split(separator: "-").compactMap { Int($0) }
        guard p.count == 3 else { return nil }
        return cal.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
    }

    static func addDays(_ key: String, _ n: Int, _ cal: Calendar) -> String? {
        guard let d = startOfDay(key, cal), let r = cal.date(byAdding: .day, value: n, to: d) else { return nil }
        return dayKey(r, cal)
    }

    static func daysBetween(_ from: String, _ to: String, _ cal: Calendar) -> Int? {
        guard let a = startOfDay(from, cal), let b = startOfDay(to, cal) else { return nil }
        return cal.dateComponents([.day], from: a, to: b).day
    }

    static func weekStart(_ key: String, _ cal: Calendar) -> String? {
        guard let d = startOfDay(key, cal) else { return nil }
        let back = (cal.component(.weekday, from: d) + 5) % 7   // Mon 0 … Sun 6
        return addDays(key, -back, cal)
    }

    // MARK: Peaks

    /// Folds a read into each day's highest reported total. `counts` is keyed by
    /// the day each bucket measured, so a total only ever lands on its own day.
    static func mergePeaks(_ peaks: [String: Int], with counts: [String: Int], today: String, _ cal: Calendar) -> [String: Int] {
        var out = peaks
        for (day, raw) in counts where raw > 0 {
            out[day] = max(out[day] ?? 0, raw)
        }
        if let oldest = addDays(today, -(lookbackDays - 1), cal) {
            out = out.filter { $0.key >= oldest }
        }
        return out
    }

    // MARK: Long-term goal

    /// Progress toward a step total between two dates (both inclusive).
    /// `doneBefore` is every counted step before today inside the range and
    /// `todaySteps` is today's. The daily need is the one signal: it holds at
    /// today's quota all day, drops as soon as today passes it, and a short day
    /// is only booked at midnight, so it never creeps up during the morning.
    static func longGoalProgress(_ plan: LongGoalPlan, today: String, doneBefore: Int, todaySteps: Int,
                                 _ cal: Calendar) -> LongGoalProgress? {
        guard plan.target > 0,
              let span = daysBetween(plan.start, plan.end, cal), span >= 0,
              let sinceStart = daysBetween(plan.start, today, cal),
              let untilEnd = daysBetween(today, plan.end, cal) else { return nil }
        let n = span + 1
        let target = plan.target
        func make(_ phase: LongGoalProgress.Phase, total: Int, perDay: Int,
                  left: Int, startsIn: Int = 0) -> LongGoalProgress {
            LongGoalProgress(target: target, start: plan.start, end: plan.end, phase: phase, total: total,
                             percent: Double(total) / Double(target), perDay: perDay,
                             daysLeft: left, totalDays: n, startsIn: startsIn)
        }
        if sinceStart < 0 {
            return make(.upcoming, total: 0, perDay: Int((Double(target) / Double(n)).rounded(.up)),
                        left: n, startsIn: -sinceStart)
        }
        if untilEnd < 0 {
            return make(doneBefore >= target ? .reached : .ended, total: doneBefore, perDay: 0, left: 0)
        }
        let left = n - sinceStart
        let total = doneBefore + todaySteps
        if total >= target { return make(.reached, total: total, perDay: 0, left: left) }
        let remaining = target - doneBefore
        let quota = Double(remaining) / Double(left)
        let perDay: Int
        if left > 1 && Double(todaySteps) > quota {
            perDay = Int((Double(remaining - todaySteps) / Double(left - 1)).rounded(.up))
        } else {
            perDay = Int(quota.rounded(.up))
        }
        return make(.active, total: total, perDay: perDay, left: left)
    }

    // MARK: Compute

    static func compute(today: String, counts: [String: Int], peaks: [String: Int],
                        settings: StepSettings, computedAt: Double, _ cal: Calendar) -> StepSummary {
        let goal = max(1, settings.goal)
        let k = settings.calibration
        let calibrate = { (raw: Int) -> Int in Int((Double(raw) * k).rounded()) }

        var days: [StepDay] = []
        days.reserveCapacity(lookbackDays)
        for back in stride(from: lookbackDays - 1, through: 0, by: -1) {
            guard let key = addDays(today, -back, cal) else { continue }
            let raw = counts[key] ?? 0
            let peak = peaks[key] ?? 0
            let steps = calibrate(max(raw, peak))
            days.append(StepDay(date: key, raw: raw, peak: peak, steps: steps,
                                hasData: counts[key] != nil || peaks[key] != nil,
                                hit: steps >= goal, rescued: false, counts: steps >= goal))
        }
        guard let todayIndex = days.indices.last, days[todayIndex].date == today else {
            return StepSummary(date: today, todayRaw: 0, todaySteps: 0, goal: goal, goalMet: false,
                               todayCounts: false, streak: 0, streakBase: 0, weekTotal: 0,
                               weekTarget: goal, weekFullTarget: goal * 7, weekOnPace: false,
                               workoutsThisWeek: 0, workoutGoal: max(1, settings.workoutGoal),
                               last14: [], computedAt: computedAt)
        }

        // Weekly buffer: a day under the goal still counts while the week is less
        // than one day's goal behind pace, and a day that fell behind counts back as
        // soon as a later day in the same week catches the week up — miss two in a
        // row, make the steps up by Sunday, and the whole week counts. Today is
        // judged as if it ended now.
        var runningWeek = ""
        var runningTotal = 0
        var weekTotal = 0
        var weekTarget = goal
        var weekOf = [String](repeating: "", count: days.count)
        var onPace = [Bool](repeating: false, count: days.count)
        for idx in days.indices {
            let ws = weekStart(days[idx].date, cal) ?? days[idx].date
            if ws != runningWeek { runningWeek = ws; runningTotal = 0 }
            runningTotal += days[idx].steps
            let dayNumber = (daysBetween(ws, days[idx].date, cal) ?? 0) + 1   // Mon 1 … Sun 7
            weekOf[idx] = ws
            onPace[idx] = goal * dayNumber - runningTotal < goal
            if idx == todayIndex { weekTotal = runningTotal; weekTarget = goal * dayNumber }
        }
        var laterWeek = ""
        var laterOnPace = false
        for idx in days.indices.reversed() {   // newest first: carry the catch-up back
            if weekOf[idx] != laterWeek { laterWeek = weekOf[idx]; laterOnPace = false }
            if onPace[idx] { laterOnPace = true }
            if !days[idx].hit && laterOnPace {
                days[idx].rescued = true
                days[idx].counts = true
            }
        }

        var base = 0
        var i = todayIndex - 1
        while i >= 0 && days[i].counts { base += 1; i -= 1 }

        let now = days[todayIndex]
        let ws = weekStart(today, cal) ?? today

        var longGoal: LongGoalProgress? = nil
        if let plan = settings.longGoal {
            var done = 0
            var todayIn = 0
            for d in days where d.date >= plan.start && d.date <= plan.end {
                if d.date < today { done += d.steps } else if d.date == today { todayIn = d.steps }
            }
            longGoal = longGoalProgress(plan, today: today, doneBefore: done, todaySteps: todayIn, cal)
        }

        return StepSummary(
            date: today, todayRaw: max(now.raw, now.peak), todaySteps: now.steps, goal: goal,
            goalMet: now.hit, todayCounts: now.counts,
            streak: base + (now.counts ? 1 : 0), streakBase: base,
            weekTotal: weekTotal, weekTarget: weekTarget, weekFullTarget: goal * 7,
            weekOnPace: weekTotal >= weekTarget,
            workoutsThisWeek: settings.workoutDates.filter { $0 >= ws && $0 <= today }.count,
            workoutGoal: max(1, settings.workoutGoal),
            last14: Array(days.suffix(14)), computedAt: computedAt, longGoal: longGoal)
    }

    // MARK: Carry forward without a read

    /// Moves a summary onto a later day when HealthKit can't be read (the phone
    /// is locked during a background refresh). Today starts empty, and the
    /// streak neither grows nor breaks on a day that couldn't be read.
    static func project(_ s: StepSummary, to today: String, settings: StepSettings, _ cal: Calendar) -> StepSummary {
        guard s.date != today, let gap = daysBetween(s.date, today, cal), gap > 0 else { return s }
        var out = s
        let carried = s.todayCounts ? s.streak : s.streakBase
        out.date = today
        out.todayRaw = 0
        out.todaySteps = 0
        out.goalMet = false
        out.todayCounts = false
        out.streakBase = carried
        out.streak = carried
        let wsNew = weekStart(today, cal) ?? today
        if weekStart(s.date, cal) != wsNew { out.weekTotal = 0 }
        out.workoutsThisWeek = settings.workoutDates.filter { $0 >= wsNew && $0 <= today }.count
        let finished = min(max(daysBetween(wsNew, today, cal) ?? 0, 0), 7)
        out.weekTarget = s.goal * (finished + 1)
        out.weekOnPace = out.weekTotal >= out.weekTarget
        if let plan = settings.longGoal, let old = s.longGoal,
           old.target == plan.target, old.start == plan.start, old.end == plan.end {
            out.longGoal = longGoalProgress(plan, today: today, doneBefore: old.total, todaySteps: 0, cal)
        } else {
            out.longGoal = nil
        }
        let byDate = Dictionary(s.last14.map { ($0.date, $0) }, uniquingKeysWith: { a, _ in a })
        out.last14 = (0..<14).reversed().compactMap { back in
            guard let key = addDays(today, -back, cal) else { return nil }
            return byDate[key] ?? StepDay(date: key, raw: 0, peak: 0, steps: 0, hasData: false,
                                          hit: false, rescued: false, counts: false)
        }
        return out
    }
}
