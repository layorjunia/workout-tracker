// Widget layout check: renders the real StreakWidget views to PNG on macOS at the exact widget sizes.
// Not part of the Xcode project. Run from the project root; everything stays in scratch/ (git-ignored):
//   mkdir -p scratch/widget-render && cd scratch/widget-render
//   cp ../../ios/App/Shared/StepEngine.swift ../../ios/App/Shared/StepStore.swift .
//   cp ../../ios/App/StreakWidget/StreakWidget.swift Widget.swift
//   cp ../../ios/tests/WidgetRender.swift main.swift
//   In Widget.swift, delete the `@main` line and replace `@Environment(\.widgetFamily) var family`
//   with `var family: WidgetFamily = .systemSmall`.
//   swiftc -O -o render StepEngine.swift StepStore.swift Widget.swift main.swift && ./render
// One PNG per state lands next to it. Anything crossing the red outline overflows on the phone.

import SwiftUI
import WidgetKit
import AppKit

let cal = StepEngine.calendar()
let today = StepEngine.dayKey(Date(), cal)

func summary(streakDays: Int, todaySteps: Int, plan: LongGoalPlan?, perDay: Int, older: Int = 3000) -> StepSummary {
    var counts: [String: Int] = [:]
    for back in 1...max(streakDays, 12) {
        if let d = StepEngine.addDays(today, -back, cal) { counts[d] = back <= streakDays ? perDay : older }
    }
    counts[today] = todaySteps
    return StepEngine.compute(today: today, counts: counts, peaks: [:],
                              settings: StepSettings(workoutDates: [today, today], longGoal: plan), computedAt: 0, cal)
}
func plan(daysAgo: Int, daysAhead: Int, target: Int = 1_000_000) -> LongGoalPlan {
    LongGoalPlan(target: target, start: StepEngine.addDays(today, -daysAgo, cal)!, end: StepEngine.addDays(today, daysAhead, cal)!)
}

@MainActor
func render(_ name: String, _ s: StepSummary, _ family: WidgetFamily) {
    let side: CGFloat = 16
    let w: CGFloat = family == .systemMedium ? 338 : 158
    let h: CGFloat = 158
    let inner = StreakWidgetView(entry: StepEntry(date: .now, summary: s), family: family)
        .frame(width: w - side * 2, height: h - side * 2, alignment: .center)
        .overlay(Rectangle().stroke(Color.red.opacity(0.6), lineWidth: 0.5))      // content bounds
    let v = ZStack { Color(white: 0.16); inner }
        .frame(width: w, height: h)
        .environment(\.colorScheme, .dark)
    let r = ImageRenderer(content: v)
    r.scale = 3
    if let img = r.nsImage, let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
       let png = rep.representation(using: NSBitmapImageRep.FileType.png, properties: [:]) {
        try? png.write(to: URL(fileURLWithPath: "\(name).png"))
    }
}

let cases: [(String, StepSummary)] = [
    ("a_lowered_a_little", summary(streakDays: 3,  todaySteps: 6500,  plan: plan(daysAgo: 2, daysAhead: 89), perDay: 15000)),
    ("b_lowered_a_lot",    summary(streakDays: 9,  todaySteps: 21000, plan: plan(daysAgo: 11, daysAhead: 60), perDay: 18000)),
    ("c_raised",           summary(streakDays: 9,  todaySteps: 3200,  plan: plan(daysAgo: 40, daysAhead: 50), perDay: 11000)),
    ("d_milestone",        summary(streakDays: 13, todaySteps: 11000, plan: plan(daysAgo: 13, daysAhead: 78), perDay: 17000)),
    ("e_big_numbers",      summary(streakDays: 30, todaySteps: 18400, plan: plan(daysAgo: 100, daysAhead: 100, target: 2_500_000), perDay: 12000)),
    ("f_reached",          summary(streakDays: 3,  todaySteps: 6500,  plan: plan(daysAgo: 2, daysAhead: 80, target: 30_000), perDay: 15000)),
    ("g_upcoming",         summary(streakDays: 3,  todaySteps: 6500,  plan: plan(daysAgo: -5, daysAhead: 80), perDay: 15000)),
    ("h_ended",            summary(streakDays: 3,  todaySteps: 6500,  plan: LongGoalPlan(target: 1_000_000, start: StepEngine.addDays(today, -11, cal)!, end: StepEngine.addDays(today, -1, cal)!), perDay: 15000)),
]
MainActor.assumeIsolated {
    for (n, s) in cases {
        render("medium_\(n)", s, .systemMedium)
        render("small_\(n)", s, .systemSmall)
        if let g = s.longGoal { print("\(n): \(g.phase) pct=\(Int(g.percent*100)) perDay=\(g.perDay) plan=\(g.planPerDay) lowered=\(g.loweredBy) left=\(g.daysLeft)") }
    }
}
