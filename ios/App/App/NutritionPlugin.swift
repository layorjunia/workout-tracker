import Foundation
import Capacitor
import HealthKit

/// Reads per-day dietary totals (calories, protein, carbs, fat) from HealthKit.
/// Food-logging apps (MyFitnessPal, Cronometer, …) write these types when the
/// user enables their Apple Health integration; this plugin just sums them.
///
/// JS surface (window.Capacitor.Plugins.Nutrition):
///   requestAuthorization()                → { granted: Bool }
///   dailyTotals({ startDate, endDate })   → { days: { "YYYY-MM-DD": { calories, protein, carbs, fat } } }
@objc(NutritionPlugin)
public class NutritionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NutritionPlugin"
    public let jsName = "Nutrition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "dailyTotals", returnType: CAPPluginReturnPromise),
    ]

    private let store = HKHealthStore()
    private let types: [(key: String, id: HKQuantityTypeIdentifier, unit: HKUnit)] = [
        ("calories", .dietaryEnergyConsumed, .kilocalorie()),
        ("protein",  .dietaryProtein,        .gram()),
        ("carbs",    .dietaryCarbohydrates,  .gram()),
        ("fat",      .dietaryFatTotal,       .gram()),
    ]

    private var readTypes: Set<HKObjectType> {
        Set(types.compactMap { HKObjectType.quantityType(forIdentifier: $0.id) })
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Health data is not available on this device")
            return
        }
        store.requestAuthorization(toShare: nil, read: readTypes) { ok, err in
            if let err = err { call.reject(err.localizedDescription); return }
            call.resolve(["granted": ok])
        }
    }

    @objc func dailyTotals(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("Health data is not available on this device")
            return
        }
        let iso = ISO8601DateFormatter()
        let isoFrac = ISO8601DateFormatter()
        isoFrac.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        func parse(_ s: String?) -> Date? {
            guard let s = s else { return nil }
            return isoFrac.date(from: s) ?? iso.date(from: s)
        }
        let cal = Calendar.current
        let end = parse(call.getString("endDate")) ?? Date()
        let start = parse(call.getString("startDate")) ?? cal.date(byAdding: .day, value: -7, to: end)!
        let anchor = cal.startOfDay(for: start)
        var interval = DateComponents(); interval.day = 1

        let dayFmt = DateFormatter()
        dayFmt.calendar = cal
        dayFmt.timeZone = TimeZone.current
        dayFmt.dateFormat = "yyyy-MM-dd"

        var result: [String: [String: Double]] = [:]
        let lock = NSLock()
        let group = DispatchGroup()

        for t in types {
            guard let qt = HKObjectType.quantityType(forIdentifier: t.id) else { continue }
            group.enter()
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
            let query = HKStatisticsCollectionQuery(
                quantityType: qt,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: anchor,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, collection, _ in
                collection?.enumerateStatistics(from: start, to: end) { stats, _ in
                    guard let sum = stats.sumQuantity()?.doubleValue(for: t.unit), sum > 0 else { return }
                    let day = dayFmt.string(from: stats.startDate)
                    lock.lock()
                    result[day, default: [:]][t.key] = sum
                    lock.unlock()
                }
                group.leave()
            }
            store.execute(query)
        }

        group.notify(queue: .main) {
            call.resolve(["days": result])
        }
    }
}
