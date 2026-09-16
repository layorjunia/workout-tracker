import Foundation
import Capacitor
import UserNotifications
import WidgetKit

/// Bridge between the web app and the native step engine.
/// Registered in MainViewController.capacitorDidLoad().
@objc(StreakBridgePlugin)
public class StreakBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StreakBridgePlugin"
    public let jsName = "StreakBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "refresh", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestNotifications", returnType: CAPPluginReturnPromise),
    ]

    static let notifId = "step-goal-reminder"

    /// Saves the settings the app passes, reads HealthKit, and returns the summary
    /// along with the day-keyed totals it was computed from.
    @objc func refresh(_ call: CAPPluginCall) {
        if call.getBool("hasSettings") == true {
            var s = StepStore.loadSettings()
            s.goal = call.getInt("goal") ?? s.goal
            s.calApple = call.getDouble("calApple")
            s.calActual = call.getDouble("calActual")
            s.workoutGoal = call.getInt("workoutGoal") ?? s.workoutGoal
            s.reminderEnabled = call.getBool("reminderEnabled") ?? s.reminderEnabled
            s.reminderHour = call.getInt("reminderHour") ?? s.reminderHour
            s.workoutDates = call.getArray("workoutDates", String.self) ?? s.workoutDates
            StepStore.saveSettings(s)
        }
        StepStore.refresh(source: "app") { summary, fresh in
            Self.afterRefresh(summary)
            var result: [String: Any] = ["readOK": fresh != nil]
            if let data = try? JSONEncoder().encode(summary),
               let obj = try? JSONSerialization.jsonObject(with: data) {
                result["summary"] = obj
            }
            if let fresh {
                result["counts"] = fresh.counts
                result["peaks"] = fresh.peaks
            }
            call.resolve(result)
        }
    }

    @objc func requestNotifications(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { granted, _ in
            call.resolve(["granted": granted])
        }
    }

    /// Refreshes the widget if what it shows changed, and re-arms the reminder.
    static func afterRefresh(_ s: StepSummary) {
        if #available(iOS 14.0, *), StepStore.widgetNeedsReload(for: s) {
            WidgetCenter.shared.reloadAllTimelines()
        }
        let settings = StepStore.loadSettings()
        rescheduleReminder(enabled: settings.reminderEnabled, hour: settings.reminderHour,
                           todayHit: s.todayCounts, stepsToday: s.todaySteps, goal: s.goal, streak: s.streak)
    }

    /// One pending notification at the reminder hour; replaced on every refresh,
    /// cancelled once today counts.
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
