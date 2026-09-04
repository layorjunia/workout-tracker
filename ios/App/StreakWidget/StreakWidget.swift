import WidgetKit
import SwiftUI

// Reads the snapshot the app writes into the App Group. No HealthKit here —
// widgets can't query it; the app + background refresh keep this fresh.
struct StreakSnapshot: Decodable {
    var stepsToday: Int = 0
    var goal: Int = 10000
    var streak: Int = 0
    var todayHit: Bool = false
    var last7: [Day] = []
    var workoutsThisWeek: Int = 0
    var workoutGoal: Int = 3
    var weekHit: Bool = false
    var date: String = ""
    var streakBase: Int = 0
    var stale: Bool = false
    struct Day: Decodable {
        var date: String = ""
        var hit: Bool = false
        var known: Bool = false
        init() {}
        enum K: String, CodingKey { case date, hit, known }
        init(from dec: Decoder) throws {
            let c = try dec.container(keyedBy: K.self)
            date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
            hit = (try? c.decodeIfPresent(Bool.self, forKey: .hit)) ?? false
            known = (try? c.decodeIfPresent(Bool.self, forKey: .known)) ?? false
        }
    }
    init() {}
    init(stepsToday: Int, goal: Int, streak: Int, todayHit: Bool, last7: [Day]) {
        self.stepsToday = stepsToday; self.goal = goal; self.streak = streak
        self.todayHit = todayHit; self.last7 = last7
    }
    enum K: String, CodingKey { case stepsToday, goal, streak, todayHit, last7, workoutsThisWeek, workoutGoal, weekHit, date, streakBase }
    init(from dec: Decoder) throws {
        let c = try dec.container(keyedBy: K.self)
        stepsToday = (try? c.decodeIfPresent(Int.self, forKey: .stepsToday)) ?? 0
        goal = (try? c.decodeIfPresent(Int.self, forKey: .goal)) ?? 10000
        streak = (try? c.decodeIfPresent(Int.self, forKey: .streak)) ?? 0
        todayHit = (try? c.decodeIfPresent(Bool.self, forKey: .todayHit)) ?? false
        last7 = (try? c.decodeIfPresent([Day].self, forKey: .last7)) ?? []
        workoutsThisWeek = (try? c.decodeIfPresent(Int.self, forKey: .workoutsThisWeek)) ?? 0
        workoutGoal = (try? c.decodeIfPresent(Int.self, forKey: .workoutGoal)) ?? 3
        weekHit = (try? c.decodeIfPresent(Bool.self, forKey: .weekHit)) ?? false
        date = (try? c.decodeIfPresent(String.self, forKey: .date)) ?? ""
        streakBase = (try? c.decodeIfPresent(Int.self, forKey: .streakBase)) ?? max(0, streak - (todayHit ? 1 : 0))
    }

    /// Project onto the given moment. A snapshot written yesterday describes
    /// yesterday — rendering it unprojected is what showed a stale step count
    /// and a stale streak after midnight.
    func projected(to when: Date) -> StreakSnapshot {
        guard !date.isEmpty else { return self }
        let today = StreakRollover.localDay(when)
        if date == today { return self }
        let rolled = StreakRollover.project(
            StreakCore(date: date, stepsToday: stepsToday, goal: goal, streak: streak,
                       streakBase: streakBase, todayHit: todayHit,
                       workoutsThisWeek: workoutsThisWeek, weekHit: weekHit,
                       workoutGoal: workoutGoal),
            to: today)
        var out = self
        out.date = rolled.date
        out.stepsToday = rolled.stepsToday
        out.todayHit = rolled.todayHit
        out.streak = rolled.streak
        out.streakBase = rolled.streakBase
        out.workoutsThisWeek = rolled.workoutsThisWeek
        out.weekHit = rolled.weekHit
        out.stale = rolled.stale
        // Slide the 7-day strip so yesterday takes its finished place.
        if StreakRollover.dayGap(from: date, to: today) == 1, !last7.isEmpty {
            var days = last7
            var finished = Day()
            finished.date = date; finished.hit = todayHit; finished.known = true
            days.removeFirst()
            days.append(finished)
            out.last7 = days
        }
        return out
    }
}

func loadSnapshot() -> StreakSnapshot {
    // Primary: the shared App Group container. On success, keep a last-good
    // copy in this extension's own defaults so a transiently unreadable
    // container (e.g. right after a reboot) shows the previous truth instead
    // of zeroing the streak.
    if let json = UserDefaults(suiteName: "group.com.layorjunia.workouttracker")?.string(forKey: "streakSnapshot"),
       let data = json.data(using: .utf8),
       let snap = try? JSONDecoder().decode(StreakSnapshot.self, from: data) {
        UserDefaults.standard.set(json, forKey: "lastGoodSnapshot")
        return snap
    }
    if let json = UserDefaults.standard.string(forKey: "lastGoodSnapshot"),
       let data = json.data(using: .utf8),
       let snap = try? JSONDecoder().decode(StreakSnapshot.self, from: data) {
        return snap
    }
    return StreakSnapshot()
}

struct StreakEntry: TimelineEntry {
    let date: Date
    let snap: StreakSnapshot
}

struct StreakProvider: TimelineProvider {
    func placeholder(in context: Context) -> StreakEntry { StreakEntry(date: .now, snap: StreakSnapshot(stepsToday: 6500, goal: 10000, streak: 4, todayHit: false, last7: [])) }
    func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
        completion(StreakEntry(date: .now, snap: loadSnapshot().projected(to: .now)))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
        let raw = loadSnapshot()
        let now = Date()
        var entries = [StreakEntry(date: now, snap: raw.projected(to: now))]
        // Pre-render the day rollover. Timeline entries are honored even when the
        // widget-reload budget is exhausted, so midnight always lands on time
        // instead of waiting for the next app open.
        if let midnight = Calendar.current.nextDate(after: now, matching: DateComponents(hour: 0, minute: 0),
                                                    matchingPolicy: .nextTime) {
            entries.append(StreakEntry(date: midnight, snap: raw.projected(to: midnight)))
            let after = midnight.addingTimeInterval(300)
            completion(Timeline(entries: entries, policy: .after(after)))
            return
        }
        completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(1800))))
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
    var entry: StreakEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let s = entry.snap
        let pct = s.goal > 0 ? Double(s.stepsToday) / Double(s.goal) : 0
        let tier = tierFor(s.streak)
        switch family {
        case .systemMedium:
            HStack(spacing: 16) {
                ring(s: s, pct: pct, tier: tier)
                VStack(alignment: .leading, spacing: 5) {
                    flame(s: s, tier: tier)
                    if tier.milestone {
                        Text("✨ \(tier.label)! ✨")
                            .font(.system(size: 12, weight: .heavy))
                            .foregroundStyle(tier.color)
                    } else if !tier.label.isEmpty {
                        Text(tier.label)
                            .font(.system(size: 10, weight: .heavy))
                            .tracking(1)
                            .padding(.horizontal, 7).padding(.vertical, 2)
                            .background(tier.color.opacity(0.18), in: Capsule())
                            .foregroundStyle(tier.color)
                    }
                    Text("\(s.stepsToday.formatted()) / \(s.goal.formatted()) steps")
                        .font(.system(size: 13, weight: .semibold)).foregroundStyle(.secondary)
                    Text("🏋️ \(s.workoutsThisWeek)/\(s.workoutGoal) workouts\(s.weekHit ? " ✓" : "")")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(s.weekHit ? Color.green : Color.purple)
                    HStack(spacing: 5) {
                        ForEach(Array(s.last7.enumerated()), id: \.offset) { _, d in
                            RoundedRectangle(cornerRadius: 3)
                                .fill(d.hit ? Color.green : (d.known ? Color.red.opacity(0.35) : Color.primary.opacity(0.12)))
                                .frame(width: 16, height: 16)
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        default:
            VStack(spacing: 7) {
                ring(s: s, pct: pct, tier: tier)
                flame(s: s, tier: tier)
                if tier.milestone {
                    Text("✨ \(tier.label) ✨").font(.system(size: 10, weight: .heavy)).foregroundStyle(tier.color)
                } else if !tier.label.isEmpty {
                    Text(tier.label).font(.system(size: 9, weight: .heavy)).tracking(1).foregroundStyle(tier.color)
                }
            }
        }
    }

    // Outer ring: today's steps. Inner ring: workouts this week vs goal.
    func ring(s: StreakSnapshot, pct: Double, tier: Tier) -> some View {
        let wkPct = s.workoutGoal > 0 ? Double(s.workoutsThisWeek) / Double(s.workoutGoal) : 0
        return ZStack {
            RingView(pct: pct, done: s.todayHit, tint: s.streak >= 7 ? tier.color : .blue, lineWidth: 7)
            RingView(pct: wkPct, done: s.weekHit, tint: .purple, lineWidth: 5)
                .frame(width: 46, height: 46)
            Text(fmtSteps(s.stepsToday))
                .font(.system(size: 13, weight: .heavy))
                .minimumScaleFactor(0.5).lineLimit(1)
                .frame(maxWidth: 34)
        }
        .frame(width: 66, height: 66)
    }

    func flame(s: StreakSnapshot, tier: Tier) -> some View {
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
        StaticConfiguration(kind: "StreakWidget", provider: StreakProvider()) { entry in
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
