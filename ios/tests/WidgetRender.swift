// Widget layout check: renders the real StreakWidget views to PNG on macOS at the exact widget sizes,
// dark and light. Not part of the Xcode project. Run it with  scripts/widget-render.sh  from the project
// root: everything lands in scratch/widget-render (git-ignored) as <family>_<state>_<dark|light>.png, and
// contact sheets of them. The red outline marks the content area (306x126 medium, 126x126 small);
// anything crossing it overflows on the phone. CLEAN=1 scripts/widget-render.sh leaves the outline out.

import SwiftUI
import WidgetKit
import AppKit

let cal = StepEngine.calendar()
let today = StepEngine.dayKey(Date(), cal)
let showBounds = ProcessInfo.processInfo.environment["CLEAN"] == nil     // CLEAN=1 leaves out the red outline

func summary(streakDays: Int, todaySteps: Int, plan: LongGoalPlan?, perDay: Int, older: Int = 3000, mixed: [Int]? = nil) -> StepSummary {
    var counts: [String: Int] = [:]
    for back in 1...max(streakDays, 12) {
        if let d = StepEngine.addDays(today, -back, cal) { counts[d] = back <= streakDays ? perDay : older }
    }
    if let mixed {
        for (i, n) in mixed.enumerated() { if let d = StepEngine.addDays(today, -(i + 1), cal) { counts[d] = n } }
    }
    counts[today] = todaySteps
    return StepEngine.compute(today: today, counts: counts, peaks: [:],
                              settings: StepSettings(workoutGoal: 3, workoutDates: [today, today], longGoal: plan), computedAt: 0, cal)
}
func plan(daysAgo: Int, daysAhead: Int, target: Int = 1_000_000) -> LongGoalPlan {
    LongGoalPlan(target: target, start: StepEngine.addDays(today, -daysAgo, cal)!, end: StepEngine.addDays(today, daysAhead, cal)!)
}

@MainActor
func render(_ name: String, _ s: StepSummary, _ family: WidgetFamily, _ scheme: ColorScheme) {
    let side: CGFloat = 16
    let w: CGFloat = family == .systemMedium ? 338 : 158
    let h: CGFloat = 158
    let inner = StreakWidgetView(entry: StepEntry(date: .now, summary: s), family: family)
        .frame(width: w - side * 2, height: h - side * 2, alignment: .center)
        .overlay { if showBounds { Rectangle().stroke(Color.red.opacity(0.6), lineWidth: 0.5) } }      // content bounds
    let v = ZStack { StepBackdrop(); inner }
        .frame(width: w, height: h)
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .environment(\.colorScheme, scheme)
    let r = ImageRenderer(content: v)
    r.scale = 3
    if let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
       let png = rep.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) {
        try? png.write(to: URL(fileURLWithPath: "\(name).png"))
    }
}

let mixedWeek = [12000, 7000, 10400, 4000, 11000, 9000, 10100]
let cases: [(String, StepSummary)] = [
    ("a_lowered_a_little", summary(streakDays: 3,  todaySteps: 6500,  plan: plan(daysAgo: 2, daysAhead: 89), perDay: 15000)),
    ("b_goal_met_lowered", summary(streakDays: 9,  todaySteps: 21000, plan: plan(daysAgo: 11, daysAhead: 60), perDay: 18000)),
    ("c_raised",           summary(streakDays: 9,  todaySteps: 3200,  plan: plan(daysAgo: 40, daysAhead: 50), perDay: 11000)),
    ("d_mixed_week",       summary(streakDays: 2,  todaySteps: 8400,  plan: plan(daysAgo: 30, daysAhead: 60), perDay: 12000, mixed: mixedWeek)),
    ("e_big_numbers",      summary(streakDays: 130, todaySteps: 18400, plan: plan(daysAgo: 100, daysAhead: 100, target: 2_500_000), perDay: 12000)),
    ("f_reached",          summary(streakDays: 3,  todaySteps: 6500,  plan: plan(daysAgo: 2, daysAhead: 80, target: 30_000), perDay: 15000)),
    ("g_upcoming",         summary(streakDays: 3,  todaySteps: 6500,  plan: plan(daysAgo: -5, daysAhead: 80), perDay: 15000)),
    ("h_ended",            summary(streakDays: 3,  todaySteps: 6500,  plan: LongGoalPlan(target: 1_000_000, start: StepEngine.addDays(today, -11, cal)!, end: StepEngine.addDays(today, -1, cal)!), perDay: 15000)),
    ("i_no_goal",          summary(streakDays: 12, todaySteps: 9100,  plan: nil, perDay: 12000)),
    ("j_new_start",        summary(streakDays: 0,  todaySteps: 0,     plan: plan(daysAgo: 0, daysAhead: 89), perDay: 0)),
]
MainActor.assumeIsolated {
    for (n, s) in cases {
        for (scheme, tag) in [(ColorScheme.dark, "dark"), (ColorScheme.light, "light")] {
            render("medium_\(n)_\(tag)", s, .systemMedium, scheme)
            render("small_\(n)_\(tag)", s, .systemSmall, scheme)
        }
        if let g = s.longGoal { print("\(n): \(g.phase) pct=\(Int(g.percent*100)) perDay=\(g.perDay) plan=\(g.planPerDay) lowered=\(g.loweredBy) left=\(g.daysLeft)") }
    }
}
