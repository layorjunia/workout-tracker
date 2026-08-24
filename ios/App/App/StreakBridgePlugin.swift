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
    ]

    static let appGroup = "group.com.layorjunia.workouttracker"
    static let notifId = "step-goal-reminder"

    @objc func update(_ call: CAPPluginCall) {
        let defaults = UserDefaults(suiteName: Self.appGroup)
        let snapshot: [String: Any] = [
            "stepsToday": call.getInt("stepsToday") ?? 0,
            "goal": call.getInt("goal") ?? 10000,
            "streak": call.getInt("streak") ?? 0,
            "todayHit": call.getBool("todayHit") ?? false,
            "last7": call.getArray("last7") ?? [],
            "reminderEnabled": call.getBool("reminderEnabled") ?? false,
            "reminderHour": call.getInt("reminderHour") ?? 19,
            "updatedAt": Date().timeIntervalSince1970,
        ]
        if let data = try? JSONSerialization.data(withJSONObject: snapshot),
           let json = String(data: data, encoding: .utf8) {
            defaults?.set(json, forKey: "streakSnapshot")
        }
        if #available(iOS 14.0, *) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        Self.rescheduleReminder(
            enabled: call.getBool("reminderEnabled") ?? false,
            hour: call.getInt("reminderHour") ?? 19,
            todayHit: call.getBool("todayHit") ?? false,
            stepsToday: call.getInt("stepsToday") ?? 0,
            goal: call.getInt("goal") ?? 10000,
            streak: call.getInt("streak") ?? 0
        )
        call.resolve()
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
