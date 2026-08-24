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

struct RingView: View {
    let pct: Double
    let done: Bool
    var body: some View {
        ZStack {
            Circle().stroke(Color.primary.opacity(0.12), lineWidth: 8)
            Circle()
                .trim(from: 0, to: max(0.02, min(1, pct)))
                .stroke(done ? Color.green : Color.blue, style: StrokeStyle(lineWidth: 8, lineCap: .round))
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
        switch family {
        case .systemMedium:
            HStack(spacing: 16) {
                ring(s: s, pct: pct)
                VStack(alignment: .leading, spacing: 6) {
                    flame(s: s)
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
            VStack(spacing: 8) {
                ring(s: s, pct: pct)
                flame(s: s)
            }
        }
    }

    func ring(s: StreakSnapshot, pct: Double) -> some View {
        ZStack {
            RingView(pct: pct, done: s.todayHit)
            VStack(spacing: 0) {
                Text("\(s.stepsToday / 1000)").font(.system(size: 20, weight: .heavy)) +
                Text("k").font(.system(size: 12, weight: .bold)).foregroundStyle(.secondary)
            }
        }
        .frame(width: 64, height: 64)
    }

    func flame(s: StreakSnapshot) -> some View {
        HStack(spacing: 4) {
            Text(s.streak > 0 ? "🔥" : "•")
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
