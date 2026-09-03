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
    struct Day: Decodable { var date: String; var hit: Bool; var known: Bool }
}

func loadSnapshot() -> StreakSnapshot {
    guard
        let json = UserDefaults(suiteName: "group.com.layorjunia.workouttracker")?.string(forKey: "streakSnapshot"),
        let data = json.data(using: .utf8),
        let snap = try? JSONDecoder().decode(StreakSnapshot.self, from: data)
    else { return StreakSnapshot() }
    return snap
}

struct StreakEntry: TimelineEntry {
    let date: Date
    let snap: StreakSnapshot
}

struct StreakProvider: TimelineProvider {
    func placeholder(in context: Context) -> StreakEntry { StreakEntry(date: .now, snap: StreakSnapshot(stepsToday: 6500, goal: 10000, streak: 4, todayHit: false, last7: [])) }
    func getSnapshot(in context: Context, completion: @escaping (StreakEntry) -> Void) {
        completion(StreakEntry(date: .now, snap: loadSnapshot()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<StreakEntry>) -> Void) {
        let entry = StreakEntry(date: .now, snap: loadSnapshot())
        let next = Calendar.current.date(byAdding: .minute, value: 30, to: .now)!
        completion(Timeline(entries: [entry], policy: .after(next)))
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
    var body: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.12), lineWidth: 8)
            Circle()
                .trim(from: 0, to: max(0.02, min(1, pct)))
                .stroke(done ? Color.green : tint, style: StrokeStyle(lineWidth: 8, lineCap: .round))
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

    func ring(s: StreakSnapshot, pct: Double, tier: Tier) -> some View {
        ZStack {
            RingView(pct: pct, done: s.todayHit, tint: s.streak >= 7 ? tier.color : .blue)
            Text(fmtSteps(s.stepsToday))
                .font(.system(size: s.stepsToday >= 10000 ? 15 : 17, weight: .heavy))
                .minimumScaleFactor(0.6).lineLimit(1)
                .frame(maxWidth: 52)
        }
        .frame(width: 64, height: 64)
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
