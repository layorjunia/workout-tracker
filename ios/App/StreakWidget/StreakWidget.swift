import WidgetKit
import SwiftUI

struct StepEntry: TimelineEntry {
    let date: Date
    let summary: StepSummary
}

extension StepSummary {
    static var preview: StepSummary {
        let cal = StepEngine.calendar()
        let today = StepEngine.dayKey(Date(), cal)
        var counts: [String: Int] = [:]
        for back in 0..<10 {
            if let d = StepEngine.addDays(today, -back, cal) { counts[d] = back == 0 ? 6500 : 11000 }
        }
        let plan = LongGoalPlan(target: 1_000_000,
                                start: StepEngine.addDays(today, -9, cal) ?? today,
                                end: StepEngine.addDays(today, 80, cal) ?? today)
        return StepEngine.compute(today: today, counts: counts, peaks: [:],
                                  settings: StepSettings(workoutDates: [today], longGoal: plan), computedAt: 0, cal)
    }
}

struct StepProvider: TimelineProvider {
    func placeholder(in context: Context) -> StepEntry { StepEntry(date: .now, summary: .preview) }

    func getSnapshot(in context: Context, completion: @escaping (StepEntry) -> Void) {
        if context.isPreview { completion(StepEntry(date: .now, summary: .preview)); return }
        StepStore.refresh(source: "widget") { summary, _ in
            completion(StepEntry(date: .now, summary: summary))
        }
    }

    /// Reads HealthKit on every refresh so the widget doesn't depend on the app
    /// having run, asks to come back in 15 minutes, and pre-renders midnight.
    func getTimeline(in context: Context, completion: @escaping (Timeline<StepEntry>) -> Void) {
        StepStore.refresh(source: "widget") { summary, _ in
            StepStore.markWidgetRendered(summary)
            let now = Date()
            let next = now.addingTimeInterval(15 * 60)
            var entries = [StepEntry(date: now, summary: summary)]
            let cal = StepEngine.calendar()
            if let midnight = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: now)), midnight < next {
                entries.append(StepEntry(date: midnight,
                                         summary: StepEngine.project(summary, to: StepEngine.dayKey(midnight, cal),
                                                                     settings: StepStore.loadSettings(), cal)))
            }
            completion(Timeline(entries: entries, policy: .after(next)))
        }
    }
}

// Week-milestone ladder — mirrored in app.js streakTier()
struct Tier {
    let emoji: String
    let label: String
    let color: Color
    let milestone: Bool
}
func tierFor(_ streak: Int) -> Tier {
    if streak <= 0 { return Tier(emoji: "·", label: "", color: .blue, milestone: false) }
    let w = streak / 7
    let milestone = streak % 7 == 0
    switch w {
    case 0:  return Tier(emoji: "🔥", label: "", color: .blue, milestone: false)
    case 1:  return Tier(emoji: "⚡", label: "WEEK 1", color: .orange, milestone: milestone)
    case 2:  return Tier(emoji: "🌟", label: "WEEK 2", color: .pink, milestone: milestone)
    case 3:  return Tier(emoji: "💎", label: "WEEK 3", color: .cyan, milestone: milestone)
    case 4, 5: return Tier(emoji: "👑", label: "1 MONTH+", color: .yellow, milestone: milestone)
    case 6, 7: return Tier(emoji: "🏆", label: "WEEK \(w)", color: .yellow, milestone: milestone)
    default: return Tier(emoji: "🐐", label: "WEEK \(w)", color: .purple, milestone: milestone)
    }
}
func fmtSteps(_ n: Int) -> String {
    if n < 1000 { return "\(n)" }
    let k = Double(n) / 1000.0
    let s = String(format: "%.1f", k)
    return (s.hasSuffix(".0") ? String(s.dropLast(2)) : s) + "k"
}

func fmtGoal(_ n: Int) -> String {
    let v = abs(n)
    if v >= 1_000_000 {
        let m = String(format: "%.2f", Double(v) / 1_000_000)
        return m.replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression) + "M"
    }
    if v >= 100_000 { return "\((v + 500) / 1000)k" }
    return fmtSteps(v)
}

/// The long-term goal as one glanceable line: where you are, whether you're on
/// the line, and what each remaining day needs.
struct GoalRow: View {
    let g: LongGoalProgress
    var compact = false

    var tint: Color {
        switch g.phase {
        case .reached: return .green
        case .ended, .upcoming: return .secondary
        case .active: return g.aheadBy >= 0 ? .green : .orange
        }
    }
    var pct: String { "\(Int((min(g.percent, 9.99) * 100).rounded(.down)))%" }
    /// How far the daily need has come down from the plan's even average.
    var lowered: Int { g.loweredBy }
    var loweredText: String { "\(lowered > 0 ? "▼" : "▲")\(fmtGoal(lowered))" }
    var status: String {
        switch g.phase {
        case .upcoming: return "starts in \(g.startsIn)d"
        case .reached: return "done ✓"
        case .ended: return "\(fmtGoal(g.aheadBy)) short"
        case .active:
            if g.aheadBy == 0 { return "on track" }
            return "\(fmtGoal(g.aheadBy)) \(g.aheadBy > 0 ? "ahead" : "behind")"
        }
    }

    var body: some View {
        if compact {
            HStack(spacing: 4) {
                Text("🎯").font(.system(size: 11))
                Text(pct).font(.system(size: 12, weight: .heavy))
                if g.phase == .active {
                    Text("\(fmtGoal(g.perDay))/d").font(.system(size: 11, weight: .semibold))
                    if lowered != 0 { Text(loweredText).font(.system(size: 10, weight: .heavy)) }
                } else {
                    Text(status).font(.system(size: 11, weight: .semibold))
                }
            }
            .foregroundStyle(tint)
            .lineLimit(1).minimumScaleFactor(0.7)
        } else {
            HStack(spacing: 7) {
                Text("🎯").font(.system(size: 12))
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(Color.primary.opacity(0.12))
                        Capsule().fill(tint).frame(width: max(5, geo.size.width * min(1, g.percent)))
                    }
                }
                .frame(height: 6)
                Text(pct).font(.system(size: 12, weight: .heavy))
                Text(status).font(.system(size: 11, weight: .semibold)).foregroundStyle(tint)
                if g.phase == .active {
                    Text("· \(fmtGoal(g.perDay))/day").font(.system(size: 11, weight: .semibold)).foregroundStyle(.secondary)
                    if lowered != 0 {
                        Text(loweredText).font(.system(size: 11, weight: .heavy))
                            .foregroundStyle(lowered > 0 ? Color.green : Color.orange)
                    }
                }
            }
            .lineLimit(1).minimumScaleFactor(0.8)
        }
    }
}

struct RingView: View {
    let pct: Double
    let done: Bool
    let tint: Color
    var lineWidth: CGFloat = 7
    var body: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.12), lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.02, min(1, pct)))
                .stroke(done ? Color.green : tint, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
        }
    }
}

struct StreakWidgetView: View {
    var entry: StepEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let s = entry.summary
        let pct = s.goal > 0 ? Double(s.todaySteps) / Double(s.goal) : 0
        let tier = tierFor(s.streak)
        let weekHit = s.workoutsThisWeek >= s.workoutGoal
        switch family {
        case .systemMedium:
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 16) {
                    ring(s: s, pct: pct, tier: tier, weekHit: weekHit)
                    VStack(alignment: .leading, spacing: 5) {
                        HStack(spacing: 7) {
                            flame(s: s, tier: tier)
                            tierBadge(tier, large: true)
                        }
                        Text("\(s.todaySteps.formatted()) / \(s.goal.formatted()) steps")
                            .font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
                        Text("🏋️ \(s.workoutsThisWeek)/\(s.workoutGoal) workouts\(weekHit ? " ✓" : "")")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(weekHit ? Color.green : Color.purple)
                        HStack(spacing: 5) {
                            ForEach(Array(s.last14.suffix(7).enumerated()), id: \.offset) { _, d in
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(d.counts ? Color.green
                                          : (d.hasData && d.date != s.date ? Color.red.opacity(0.35) : Color.primary.opacity(0.12)))
                                    .frame(width: 16, height: 16)
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
                if let g = s.longGoal { GoalRow(g: g) }
            }
        default:
            VStack(spacing: 6) {
                ring(s: s, pct: pct, tier: tier, weekHit: weekHit, size: s.longGoal == nil ? 66 : 58)
                flame(s: s, tier: tier)
                tierBadge(tier, large: false)
                if let g = s.longGoal { GoalRow(g: g, compact: true) }
            }
        }
    }

    /// Week-milestone badge; nothing until the first full week.
    @ViewBuilder
    func tierBadge(_ tier: Tier, large: Bool) -> some View {
        if tier.milestone {
            Text(large ? "✨ \(tier.label)! ✨" : "✨ \(tier.label) ✨")
                .font(.system(size: large ? 12 : 10, weight: .heavy))
                .foregroundStyle(tier.color)
        } else if !tier.label.isEmpty {
            if large {
                Text(tier.label)
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(1)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(tier.color.opacity(0.18), in: Capsule())
                    .foregroundStyle(tier.color)
            } else {
                Text(tier.label).font(.system(size: 9, weight: .heavy)).tracking(1).foregroundStyle(tier.color)
            }
        }
    }

    // Outer ring: today's steps. Inner ring: workouts this week vs goal.
    func ring(s: StepSummary, pct: Double, tier: Tier, weekHit: Bool, size: CGFloat = 66) -> some View {
        let wkPct = s.workoutGoal > 0 ? Double(s.workoutsThisWeek) / Double(s.workoutGoal) : 0
        let k = size / 66
        return ZStack {
            RingView(pct: pct, done: s.goalMet, tint: s.streak >= 7 ? tier.color : .blue, lineWidth: 7 * k)
            RingView(pct: wkPct, done: weekHit, tint: .purple, lineWidth: 5 * k)
                .frame(width: 46 * k, height: 46 * k)
            Text(fmtSteps(s.todaySteps))
                .font(.system(size: 13 * k, weight: .heavy))
                .minimumScaleFactor(0.5).lineLimit(1)
                .frame(maxWidth: 34 * k)
        }
        .frame(width: size, height: size)
    }

    func flame(s: StepSummary, tier: Tier) -> some View {
        HStack(spacing: 4) {
            Text(tier.emoji)
            Text("\(s.streak)").font(.system(size: 17, weight: .heavy))
            Text(s.streak == 1 ? "day" : "days").font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
        }
    }
}

@main
struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StreakWidget", provider: StepProvider()) { entry in
            if #available(iOS 17.0, *) {
                StreakWidgetView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
            } else {
                StreakWidgetView(entry: entry).padding()
            }
        }
        .configurationDisplayName("Workout Streak")
        .description("Today's steps and your goal streak.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
