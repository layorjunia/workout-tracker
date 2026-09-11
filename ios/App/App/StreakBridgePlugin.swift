import Foundation
import Capacitor
import UserNotifications
import WidgetKit

/// Bridge between the web app and the native streak surface:
/// • persists the streak snapshot into the App Group so the widget can read it
/// • reloads widget timelines
/// • schedules / cancels the "you haven't hit your step goal" notification
/// Registered with Capacitor via `packageClassList` in capacitor.config.json.
@objc(StreakBridgePlugin)
public class StreakBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StreakBridgePlugin"
    public let jsName = "StreakBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotifications", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
    ]

    static let appGroup = "group.com.layorjunia.workouttracker"
    static let notifId = "step-goal-reminder"

    static func localDay() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.timeZone = .current
        return f.string(from: Date())
    }

    static func readSnapshot(_ defaults: UserDefaults?) -> [String: Any]? {
        guard let json = defaults?.string(forKey: "streakSnapshot"),
              let data = json.data(using: .utf8),
              let snap = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { return nil }
        return snap
    }

    static func writeSnapshot(_ snap: [String: Any], to defaults: UserDefaults?) {
        if let data = try? JSONSerialization.data(withJSONObject: snap),
           let json = String(data: data, encoding: .utf8) {
            defaults?.set(json, forKey: "streakSnapshot")
        }
    }

    static func maybeReloadWidgets(old: [String: Any]?, new: [String: Any], defaults: UserDefaults?, foreground: Bool = false) {
        guard #available(iOS 14.0, *) else { return }
        let bucket = StreakRollover.widgetBucket(new)
        let now = Date().timeIntervalSince1970
        if StreakRollover.shouldReloadWidget(lastBucket: defaults?.string(forKey: "lastWidgetBucket"),
                                             newBucket: bucket,
                                             lastReload: defaults?.double(forKey: "lastWidgetReload") ?? 0,
                                             now: now, foreground: foreground) {
            defaults?.set(now, forKey: "lastWidgetReload")
            defaults?.set(bucket, forKey: "lastWidgetBucket")
            WidgetCenter.shared.reloadAllTimelines()
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        let existing = Self.readSnapshot(defaults)
        let day = Self.localDay()
        var steps = call.getInt("stepsToday") ?? 0
        let goal = call.getInt("goal") ?? 10000
        // A day's step count never goes back down: once a number has been shown,
        // a later, lower reading can't take it away. A calibration change is the
        // one legitimate reason it can drop.
        if let ex = existing, ex["date"] as? String == day, let exSteps = ex["stepsToday"] as? Int {
            let sameCalibration = abs((ex["calibration"] as? Double ?? 1.0) - (call.getDouble("calibration") ?? 1.0)) < 0.0001
            if steps <= 0 || sameCalibration { steps = max(steps, exSteps) }
        }
        if let raw = call.getInt("stepsRaw"), raw > 0 {
            var peaks = defaults?.dictionary(forKey: "stepPeaks") as? [String: Int] ?? [:]
            StreakRollover.recordPeak(&peaks, day: day, raw: raw)
            defaults?.set(peaks, forKey: "stepPeaks")
        }
        // Derive hit + streak from the FINAL step count so the snapshot can never
        // say "13,800 steps" and "goal not hit" at the same time. streakBase is
        // the run of completed days before today; today adds at most one.
        let streakBase = call.getInt("streakBase")
            ?? max(0, (call.getInt("streak") ?? 0) - ((call.getBool("todayHit") ?? false) ? 1 : 0))
        // A day under the goal still counts when the week is running at goal pace
        // (the app computes that from full history and passes the verdict here).
        let hit = steps >= goal || (call.getBool("weekRescued") ?? false)
        let streak = streakBase + (hit ? 1 : 0)
        let snapshot: [String: Any] = [
            "date": day,
            "stepsToday": steps,
            "goal": goal,
            "streak": streak,
            "streakBase": streakBase,
            "todayHit": hit,
            "last7": call.getArray("last7") ?? [],
            "reminderEnabled": call.getBool("reminderEnabled") ?? false,
            "reminderHour": call.getInt("reminderHour") ?? 19,
            "calibration": call.getDouble("calibration") ?? 1.0,
            "workoutsThisWeek": call.getInt("workoutsThisWeek") ?? 0,
            "workoutGoal": call.getInt("workoutGoal") ?? 3,
            "weekHit": call.getBool("weekHit") ?? false,
            "weekRescued": call.getBool("weekRescued") ?? false,
            "updatedAt": Date().timeIntervalSince1970,
        ]
        Self.writeSnapshot(snapshot, to: defaults)
        Self.maybeReloadWidgets(old: existing, new: snapshot, defaults: defaults, foreground: true)
        Self.rescheduleReminder(
            enabled: call.getBool("reminderEnabled") ?? false,
            hour: call.getInt("reminderHour") ?? 19,
            todayHit: hit, stepsToday: steps, goal: goal, streak: streak
        )
        call.resolve()
    }

    /// Diagnostic: what does the widget's shared container actually hold?
    /// Surfaced on the in-app streak card so snapshot problems are visible.
    @objc func status(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        guard let json = defaults?.string(forKey: "streakSnapshot"),
              let data = json.data(using: .utf8),
              let snap = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else {
            call.resolve(["hasSnapshot": false, "stepPeaks": defaults?.dictionary(forKey: "stepPeaks") ?? [:]])
            return
        }
        call.resolve([
            "hasSnapshot": true,
            "stepsToday": snap["stepsToday"] as? Int ?? 0,
            "updatedAt": ((snap["updatedAt"] as? Double) ?? 0) * 1000,
            "stepPeaks": defaults?.dictionary(forKey: "stepPeaks") ?? [:],
        ])
    }

    @objc func requestNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    /// One pending notification at the reminder hour; replaced on every update,
    /// cancelled the moment the goal is hit. Also used by the background refresh.
    static func rescheduleReminder(enabled: Bool, hour: Int, todayHit: Bool, stepsToday: Int, goal: Int, streak: Int) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [notifId])
        guard enabled, !todayHit else { return }

        var fire = Calendar.current.dateComponents([.year, .month, .day], from: Date())
        fire.hour = hour
        fire.minute = 0
        guard let fireDate = Calendar.current.date(from: fire), fireDate > Date() else { return }

        let remaining = max(0, goal - stepsToday)
        let content = UNMutableNotificationContent()
        if streak > 0 {
            content.title = "🔥 \(streak)-day streak on the line"
            content.body = "\(remaining.formatted()) steps to go before midnight."
        } else {
            content.title = "Step goal check"
            content.body = "\(remaining.formatted()) steps left to hit \(goal.formatted()) today."
        }
        content.sound = .default
        let trigger = UNCalendarNotificationTrigger(dateMatching: fire, repeats: false)
        center.add(UNNotificationRequest(identifier: notifId, content: content, trigger: trigger))
    }
}
