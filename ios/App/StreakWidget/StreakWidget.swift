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

// MARK: Look
// The app's own look: the icon's two colors, progress running from blue-violet to mint, rings and
// bars instead of pictures. Numbers and arrows only; no emoji.

enum Brand {
    static let blue = Color(red: 0.478, green: 0.553, blue: 1.0)
    static let mint = Color(red: 0.204, green: 0.890, blue: 0.698)
    static let amber = Color(red: 1.0, green: 0.706, blue: 0.329)
    static var sweep: LinearGradient { LinearGradient(colors: [blue, mint], startPoint: .leading, endPoint: .trailing) }
}

/// Deep navy with a blue glow top left and a mint one bottom right; a soft blue-white by day.
struct StepBackdrop: View {
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let dark = scheme == .dark
        ZStack {
            LinearGradient(colors: dark ? [Color(red: 0.078, green: 0.094, blue: 0.165), Color(red: 0.035, green: 0.043, blue: 0.078)]
                                        : [Color(red: 0.965, green: 0.972, blue: 1.0), Color(red: 0.918, green: 0.953, blue: 0.965)],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            RadialGradient(colors: [Brand.blue.opacity(dark ? 0.30 : 0.20), .clear], center: .topLeading, startRadius: 0, endRadius: 200)
            RadialGradient(colors: [Brand.mint.opacity(dark ? 0.16 : 0.14), .clear], center: .bottomTrailing, startRadius: 0, endRadius: 180)
        }
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

/// Today's progress: a ring that sweeps from blue to mint, and turns mint with a glow once the goal is met.
struct GradientRing: View {
    let pct: Double
    let done: Bool
    var lineWidth: CGFloat = 8

    var body: some View {
        let sweep = max(0.02, min(1, pct))
        ZStack {
            Circle().inset(by: lineWidth / 2).stroke(Color.primary.opacity(0.10), lineWidth: lineWidth)
            if pct > 0 {
            Circle().inset(by: lineWidth / 2)
                .trim(from: 0, to: sweep)
                .stroke(done ? AnyShapeStyle(Brand.mint)
                             : AnyShapeStyle(AngularGradient(colors: [Brand.blue, Brand.mint], center: .center,
                                                             startAngle: .degrees(0), endAngle: .degrees(360 * sweep))),
                        style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .shadow(color: done ? Brand.mint.opacity(0.55) : .clear, radius: 5)
            }
        }
    }
}

/// The long-term goal as ten segments, one per 10%, filled blue to mint along the bar.
struct SegmentBar: View {
    let fraction: Double
    var done = false
    var height: CGFloat = 6

    var body: some View {
        GeometryReader { geo in
            let gap: CGFloat = 2
            let w = (geo.size.width - gap * 9) / 10
            ZStack(alignment: .leading) {
                HStack(spacing: gap) {
                    ForEach(0..<10, id: \.self) { _ in
                        RoundedRectangle(cornerRadius: 2.5).fill(Color.primary.opacity(0.10)).frame(width: w)
                    }
                }
                fillStyle.mask(alignment: .leading) {
                    HStack(spacing: gap) {
                        ForEach(0..<10, id: \.self) { i in
                            let f = max(0, min(1, fraction * 10 - Double(i)))
                            ZStack(alignment: .leading) {
                                if f > 0 { RoundedRectangle(cornerRadius: 2.5).frame(width: max(2.5, w * f)) }
                            }
                            .frame(width: w, alignment: .leading)
                        }
                    }
                }
            }
        }
        .frame(height: height)
    }

    @ViewBuilder private var fillStyle: some View {
        if done { Brand.mint } else { Brand.sweep }
    }
}

/// A day of steps against the goal: a bar that fills toward it, full and mint once the day counts.
struct DayBar: View {
    let day: StepDay
    let goal: Int
    let isToday: Bool
    var height: CGFloat = 24

    var body: some View {
        let frac = day.hit ? 1 : min(1, Double(day.steps) / Double(max(1, goal)))
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: 3).fill(Color.primary.opacity(0.09))
            RoundedRectangle(cornerRadius: 3)
                .fill(fill)
                .frame(height: day.steps > 0 ? max(3, height * frac) : 0)
        }
        .frame(height: height)
        .overlay(RoundedRectangle(cornerRadius: 3).stroke(isToday ? Color.primary.opacity(0.55) : .clear, lineWidth: 1))
    }

    private var fill: AnyShapeStyle {
        if day.hit { return AnyShapeStyle(Brand.mint) }
        if day.counts { return AnyShapeStyle(Brand.mint.opacity(0.55)) }
        return AnyShapeStyle(Brand.blue.opacity(0.7))
    }
}

/// The last seven days, with their weekday letters.
struct WeekBars: View {
    let days: [StepDay]
    let goal: Int
    let today: String
    var height: CGFloat = 24

    var body: some View {
        HStack(alignment: .bottom, spacing: 5) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, d in
                VStack(spacing: 3) {
                    DayBar(day: d, goal: goal, isToday: d.date == today, height: height)
                    Text(letter(d.date))
                        .font(.system(size: 8, weight: .heavy))
                        .foregroundStyle(d.date == today ? Color.primary : Color.secondary.opacity(0.7))
                }
            }
        }
    }

    private func letter(_ key: String) -> String {
        let cal = StepEngine.calendar()
        guard let d = StepEngine.startOfDay(key, cal) else { return "" }
        let i = (cal.component(.weekday, from: d) + 5) % 7        // Monday 0 … Sunday 6
        return String(Array("MTWTFSS")[i])
    }
}

/// The long-term goal as one glanceable line: how far along, and the daily average the remaining days
/// need. That average is the only signal; it comes down as you walk more and goes up when you walk less.
struct GoalLine: View {
    let g: LongGoalProgress
    var compact = false

    var pct: String { "\(Int((min(g.percent, 9.99) * 100).rounded(.down)))%" }
    var lowered: Int { g.loweredBy }
    var loweredText: String { "\(lowered > 0 ? "▼" : "▲")\(fmtGoal(abs(lowered)))" }
    var loweredColor: Color { lowered > 0 ? Brand.mint : Brand.amber }
    /// Words for the phases that have no daily need to show.
    var status: String {
        switch g.phase {
        case .upcoming: return "starts in \(g.startsIn)d"
        case .reached: return "done"
        case .ended: return "\(fmtGoal(max(0, g.target - g.total))) short"
        case .active: return ""
        }
    }

    var body: some View {
        if compact {
            VStack(spacing: 5) {
                SegmentBar(fraction: min(1, g.percent), done: g.phase == .reached, height: 5)
                HStack(spacing: 4) {
                    Text(pct).font(.system(size: 12, weight: .heavy)).monospacedDigit().lineLimit(1)
                    Spacer(minLength: 0)
                    if g.phase == .active {
                        Text("\(fmtGoal(g.perDay))/day").font(.system(size: 11, weight: .bold)).foregroundStyle(.secondary).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.7)
                        if lowered != 0 {
                            Text(loweredText).font(.system(size: 10, weight: .heavy)).foregroundStyle(loweredColor).monospacedDigit()
                                .lineLimit(1).minimumScaleFactor(0.7)
                        }
                    } else {
                        Text(status).font(.system(size: 11, weight: .semibold)).foregroundStyle(g.phase == .reached ? Brand.mint : .secondary)
                            .lineLimit(1).minimumScaleFactor(0.7)
                    }
                }
            }
        } else {
            HStack(spacing: 8) {
                Text(fmtGoal(g.target)).font(.system(size: 11, weight: .heavy)).foregroundStyle(.secondary)
                SegmentBar(fraction: min(1, g.percent), done: g.phase == .reached)
                Text(pct).font(.system(size: 12, weight: .heavy)).monospacedDigit().lineLimit(1)
                if g.phase == .active {
                    Text("\(g.perDay.formatted())/day").font(.system(size: 12, weight: .bold)).foregroundStyle(.secondary).monospacedDigit()
                        .lineLimit(1).minimumScaleFactor(0.75)
                    if lowered != 0 {
                        Text(loweredText).font(.system(size: 11, weight: .heavy)).foregroundStyle(loweredColor).monospacedDigit()
                            .lineLimit(1).minimumScaleFactor(0.75)
                    }
                } else {
                    Text(status).font(.system(size: 11, weight: .semibold)).foregroundStyle(g.phase == .reached ? Brand.mint : .secondary)
                        .lineLimit(1).minimumScaleFactor(0.75)
                }
            }
        }
    }
}

struct StreakWidgetView: View {
    var entry: StepEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let s = entry.summary
        switch family {
        case .systemMedium: medium(s)
        default: small(s)
        }
    }

    // Today's steps in a ring, the streak beside it, the long-term goal underneath.
    func small(_ s: StepSummary) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                ring(s, size: 68, line: 8, caption: false)
                VStack(alignment: .leading, spacing: 0) {
                    Text("\(s.streak)")
                        .font(.system(size: s.streak >= 100 ? 23 : 30, weight: .heavy)).monospacedDigit()
                        .foregroundStyle(s.streak > 0 ? Brand.mint : Color.secondary)
                        .minimumScaleFactor(0.6).lineLimit(1).fixedSize()
                    Text(s.streak == 1 ? "DAY" : "DAYS")
                        .font(.system(size: 9, weight: .heavy)).tracking(1.2).foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            if let g = s.longGoal { GoalLine(g: g, compact: true) }
            else { workouts(s) }
        }
    }

    // The ring, the streak and the week's seven days; then the long-term goal.
    func medium(_ s: StepSummary) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 14) {
                ring(s, size: 90, line: 10, caption: true)
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 5) {
                        Text("\(s.streak)")
                            .font(.system(size: s.streak >= 100 ? 26 : 32, weight: .heavy)).monospacedDigit()
                            .foregroundStyle(s.streak > 0 ? Brand.mint : Color.secondary)
                            .lineLimit(1).fixedSize()
                        Text(s.streak >= 100 ? "days" : "day streak").font(.system(size: 12, weight: .semibold)).foregroundStyle(.secondary)
                            .lineLimit(1).minimumScaleFactor(0.8)
                        Spacer(minLength: 0)
                        workouts(s)
                    }
                    WeekBars(days: Array(s.last14.suffix(7)), goal: s.goal, today: s.date, height: 24)
                }
            }
            if let g = s.longGoal { GoalLine(g: g) }
        }
    }

    /// Today against the goal. The small widget shows only the count, the medium one the goal as well.
    func ring(_ s: StepSummary, size: CGFloat, line: CGFloat, caption: Bool) -> some View {
        let pct = s.goal > 0 ? Double(s.todaySteps) / Double(s.goal) : 0
        return ZStack {
            GradientRing(pct: pct, done: s.goalMet, lineWidth: line)
            VStack(spacing: 1) {
                Text(caption ? s.todaySteps.formatted() : fmtSteps(s.todaySteps))
                    .font(.system(size: size * (caption ? 0.19 : 0.21), weight: .heavy)).monospacedDigit()
                    .minimumScaleFactor(0.5).lineLimit(1)
                if caption {
                    Text("of \(s.goal.formatted())").font(.system(size: 9, weight: .semibold)).foregroundStyle(.secondary)
                        .minimumScaleFactor(0.7).lineLimit(1)
                }
            }
            .padding(.horizontal, line + 5)
        }
        .frame(width: size, height: size)
    }

    func workouts(_ s: StepSummary) -> some View {
        let hit = s.workoutsThisWeek >= s.workoutGoal
        return HStack(spacing: 4) {
            Text("\(s.workoutsThisWeek)/\(s.workoutGoal)").font(.system(size: 13, weight: .heavy)).monospacedDigit()
                .foregroundStyle(hit ? Brand.mint : Color.primary)
            Text("workouts").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
                .lineLimit(1).minimumScaleFactor(0.75)
        }
    }
}

@main
struct StreakWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "StreakWidget", provider: StepProvider()) { entry in
            StreakWidgetView(entry: entry)
                .containerBackground(for: .widget) { StepBackdrop() }
        }
        .configurationDisplayName("Steps & Streak")
        .description("Today's steps, your streak and your step goal.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
