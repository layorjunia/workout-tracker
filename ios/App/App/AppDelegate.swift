import UIKit
import Capacitor
import BackgroundTasks

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    static let stepCheckTaskId = "com.layorjunia.workouttracker.stepcheck"

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: Self.stepCheckTaskId, using: nil) { task in
            Self.runStepCheck(task: task as? BGAppRefreshTask)
        }
        return true
    }

    static func scheduleStepCheck() {
        let request = BGAppRefreshTaskRequest(identifier: stepCheckTaskId)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 30 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }

    /// Reads HealthKit through the same path the widget uses, then re-arms the
    /// reminder and refreshes the widget if what it shows changed.
    static func runStepCheck(task: BGAppRefreshTask?) {
        scheduleStepCheck()
        let finish = TaskFinisher(task)
        task?.expirationHandler = { finish.done(false) }
        StepStore.refresh(source: task == nil ? "app-open" : "background") { summary, _ in
            StreakBridgePlugin.afterRefresh(summary)
            finish.done(true)
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        Self.scheduleStepCheck()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
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

private final class TaskFinisher {
    private let task: BGAppRefreshTask?
    private var finished = false
    private let lock = NSLock()
    init(_ task: BGAppRefreshTask?) { self.task = task }
    func done(_ success: Bool) {
        lock.lock(); defer { lock.unlock() }
        guard !finished else { return }
        finished = true
        task?.setTaskCompleted(success: success)
    }
}
