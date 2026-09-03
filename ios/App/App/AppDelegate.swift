import UIKit
import Capacitor
import BackgroundTasks
import HealthKit
import UserNotifications
import WidgetKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    static let stepCheckTaskId = "com.layorjunia.workouttracker.stepcheck"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Background step check: re-reads HealthKit and updates/cancels the
        // step-goal notification even when the app hasn't been opened.
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.stepCheckTaskId, using: nil) { task in
            Self.runStepCheck(task: task as? BGAppRefreshTask)
        }
        return true
    }

    static func scheduleStepCheck() {
        let request = BGAppRefreshTaskRequest(identifier: stepCheckTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 2 * 60 * 60)   // ~every 2 h, at iOS's discretion
        try? BGTaskScheduler.shared.submit(request)
    }

    /// Reads today's steps straight from HealthKit (authorized via the main app),
    /// refreshes the widget snapshot, and re-arms or cancels the reminder.
    static func runStepCheck(task: BGAppRefreshTask?) {
        scheduleStepCheck()   // always keep the chain alive
        let defaults = UserDefaults(suiteName: StreakBridgePlugin.appGroup)
        // Bootstrap: if the web layer hasn't written a snapshot yet, build one
        // with defaults so the widget always has real step data to show.
        let existing = StreakBridgePlugin.readSnapshot(defaults)
        var snap: [String: Any] = existing ?? [
            "goal": 10000, "streak": 0, "todayHit": false, "last7": [],
            "reminderEnabled": false, "reminderHour": 19, "calibration": 1.0,
            "workoutsThisWeek": 0, "workoutGoal": 3, "weekHit": false]

        let goal = snap["goal"] as? Int ?? 10000

        // Consistency repair FIRST, independent of HealthKit. Whatever the stored
        // step count is, hit/streak must agree with it — a snapshot can never say
        // "13,800 steps" and "goal not hit". This runs even if the HealthKit query
        // below is slow, unauthorized, or never calls back.
        let day = StreakBridgePlugin.localDay()
        if snap["date"] as? String == day {
            let storedSteps = snap["stepsToday"] as? Int ?? 0
            let base = snap["streakBase"] as? Int
                ?? max(0, (snap["streak"] as? Int ?? 0) - ((snap["todayHit"] as? Bool ?? false) ? 1 : 0))
            let repairedHit = storedSteps >= goal
            if (snap["todayHit"] as? Bool) != repairedHit || snap["streakBase"] == nil {
                snap["todayHit"] = repairedHit
                snap["streakBase"] = base
                snap["streak"] = base + (repairedHit ? 1 : 0)
                snap["updatedAt"] = Date().timeIntervalSince1970
                StreakBridgePlugin.writeSnapshot(snap, to: defaults)
                StreakBridgePlugin.maybeReloadWidgets(old: existing, new: snap, defaults: defaults)
            }
        }

        let store = HKHealthStore()
        guard HKHealthStore.isHealthDataAvailable(),
              let stepType = HKObjectType.quantityType(forIdentifier: .stepCount)
        else { task?.setTaskCompleted(success: true); return }

        let start = Calendar.current.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(withStart: start, end: Date())
        let calibration = snap["calibration"] as? Double ?? 1.0
        let query = HKStatisticsQuery(quantityType: stepType, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, stats, _ in
            var steps = Int((stats?.sumQuantity()?.doubleValue(for: .count()) ?? 0) * calibration)
            // HealthKit can return 0/partial while the phone is locked or mid-sync.
            // Same-day values are monotonic: never write a lower number than the
            // snapshot already holds, and never zero a day that had steps.
            if snap["date"] as? String == day, let exSteps = snap["stepsToday"] as? Int {
                steps = max(steps, exSteps)
            }
            // Same derivation as the plugin: hit and streak always follow the
            // final step count, so the two writers can never disagree.
            let hit = steps >= goal
            let streakBase = snap["streakBase"] as? Int
                ?? max(0, (snap["streak"] as? Int ?? 0) - ((snap["todayHit"] as? Bool ?? false) ? 1 : 0))
            snap["date"] = day
            snap["stepsToday"] = steps
            snap["todayHit"] = hit
            snap["streakBase"] = streakBase
            snap["streak"] = streakBase + (hit ? 1 : 0)
            snap["updatedAt"] = Date().timeIntervalSince1970
            StreakBridgePlugin.writeSnapshot(snap, to: defaults)
            StreakBridgePlugin.maybeReloadWidgets(old: existing, new: snap, defaults: defaults)
            StreakBridgePlugin.rescheduleReminder(
                enabled: snap["reminderEnabled"] as? Bool ?? false,
                hour: snap["reminderHour"] as? Int ?? 19,
                todayHit: hit,
                stepsToday: steps,
                goal: goal,
                streak: streakBase + (hit ? 1 : 0)
            )
            task?.setTaskCompleted(success: true)
        }
        store.execute(query)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        Self.scheduleStepCheck()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Self-heal the widget snapshot from HealthKit on every open, so the
        // widget never shows stale numbers even if the web layer hasn't synced.
        Self.runStepCheck(task: nil)
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }



    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
