import Foundation
import HealthKit

/// App Group storage and the HealthKit read behind every step number. The app,
/// the widget, and the background refresh all go through `refresh`, so they
/// read and compute a day the same way.
enum StepStore {
    static let appGroup = "group.com.layorjunia.workouttracker"
    static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

    private static let settingsKey = "steps.v2.settings"
    private static let peaksKey = "steps.v2.peaks"
    private static let summaryKey = "steps.v2.summary"
    private static let countsKey = "steps.v2.counts"          // last good read: {today, counts}
    private static let readLogKey = "steps.v2.lastRead"       // last read attempt per source
    private static let widgetSigKey = "steps.v2.widgetSignature"

    private static let healthStore = HKHealthStore()

    // MARK: Persistence

    static func loadSettings() -> StepSettings {
        guard let data = defaults?.data(forKey: settingsKey),
              let s = try? JSONDecoder().decode(StepSettings.self, from: data) else { return StepSettings() }
        return s
    }

    static func saveSettings(_ s: StepSettings) {
        if let data = try? JSONEncoder().encode(s) { defaults?.set(data, forKey: settingsKey) }
    }

    static func loadPeaks() -> [String: Int] {
        defaults?.dictionary(forKey: peaksKey) as? [String: Int] ?? [:]
    }

    static func loadSummary() -> StepSummary? {
        guard let data = defaults?.data(forKey: summaryKey) else { return nil }
        return try? JSONDecoder().decode(StepSummary.self, from: data)
    }

    private static func saveSummary(_ s: StepSummary) {
        if let data = try? JSONEncoder().encode(s) { defaults?.set(data, forKey: summaryKey) }
    }

    private static func loadCounts() -> (today: String, counts: [String: Int])? {
        guard let obj = defaults?.dictionary(forKey: countsKey),
              let today = obj["today"] as? String,
              let counts = obj["counts"] as? [String: Int] else { return nil }
        return (today, counts)
    }

    private static func logRead(source: String, ok: Bool, detail: String) {
        var log = defaults?.dictionary(forKey: readLogKey) ?? [:]
        log[source] = ["at": Date().timeIntervalSince1970, "ok": ok, "detail": detail]
        defaults?.set(log, forKey: readLogKey)
    }

    // MARK: Widget refresh bookkeeping

    static func signature(_ s: StepSummary) -> String {
        let strip = s.last14.suffix(7).map { $0.counts ? "1" : ($0.hasData ? "0" : "-") }.joined()
        return "\(s.date)|\(s.todaySteps / 100)|\(s.goalMet)|\(s.streak)|\(s.workoutsThisWeek)/\(s.workoutGoal)|\(s.goal)|\(strip)"
    }

    static func markWidgetRendered(_ s: StepSummary) {
        defaults?.set(signature(s), forKey: widgetSigKey)
    }

    static func widgetNeedsReload(for s: StepSummary) -> Bool {
        defaults?.string(forKey: widgetSigKey) != signature(s)
    }

    // MARK: HealthKit

    enum ReadError: Error { case unavailable, noData, timedOut }

    /// Daily step totals for the lookback window, keyed by the day each bucket
    /// covers. One frozen calendar supplies the anchor, the range, and the keys.
    static func readDailyCounts(completion: @escaping (Result<(today: String, counts: [String: Int], cal: Calendar), Error>) -> Void) {
        guard HKHealthStore.isHealthDataAvailable(),
              let type = HKQuantityType.quantityType(forIdentifier: .stepCount) else {
            completion(.failure(ReadError.unavailable)); return
        }
        NSTimeZone.resetSystemTimeZone()
        let cal = StepEngine.calendar()
        let now = Date()
        let todayStart = cal.startOfDay(for: now)
        guard let start = cal.date(byAdding: .day, value: -(StepEngine.lookbackDays - 1), to: todayStart),
              let end = cal.date(byAdding: .day, value: 1, to: todayStart) else {
            completion(.failure(ReadError.unavailable)); return
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let query = HKStatisticsCollectionQuery(quantityType: type, quantitySamplePredicate: predicate,
                                                options: .cumulativeSum, anchorDate: todayStart,
                                                intervalComponents: DateComponents(day: 1))
        let once = Once()
        query.initialResultsHandler = { _, collection, error in
            guard once.claim() else { return }
            if let error { completion(.failure(error)); return }
            var counts: [String: Int] = [:]
            collection?.enumerateStatistics(from: start, to: end) { stats, _ in
                if let v = stats.sumQuantity()?.doubleValue(for: .count()), v > 0 {
                    counts[StepEngine.dayKey(stats.startDate, cal)] = Int(v.rounded())
                }
            }
            // Nothing across the whole window means the read wasn't permitted,
            // not that no steps were taken.
            if counts.isEmpty { completion(.failure(ReadError.noData)); return }
            completion(.success((StepEngine.dayKey(now, cal), counts, cal)))
        }
        healthStore.execute(query)
        DispatchQueue.global().asyncAfter(deadline: .now() + 10) {
            guard once.claim() else { return }
            healthStore.stop(query)
            completion(.failure(ReadError.timedOut))
        }
    }

    /// Read → fold into per-day highs → compute → persist. When HealthKit can't
    /// be read (phone locked), recompute from the last good read if it's still
    /// the same day; otherwise carry the last summary forward.
    static func refresh(source: String,
                        completion: @escaping (_ summary: StepSummary, _ fresh: (counts: [String: Int], peaks: [String: Int])?) -> Void) {
        readDailyCounts { result in
            let settings = loadSettings()
            let computedAt = Date().timeIntervalSince1970
            switch result {
            case .success(let r):
                let peaks = StepEngine.mergePeaks(loadPeaks(), with: r.counts, today: r.today, r.cal)
                defaults?.set(peaks, forKey: peaksKey)
                defaults?.set(["today": r.today, "counts": r.counts], forKey: countsKey)
                let summary = StepEngine.compute(today: r.today, counts: r.counts, peaks: peaks,
                                                 settings: settings, computedAt: computedAt, r.cal)
                saveSummary(summary)
                logRead(source: source, ok: true, detail: "\(r.today) raw=\(r.counts[r.today] ?? 0) days=\(r.counts.count)")
                completion(summary, (r.counts, peaks))
            case .failure(let error):
                let cal = StepEngine.calendar()
                let today = StepEngine.dayKey(Date(), cal)
                let summary: StepSummary
                if let last = loadCounts(), last.today == today {
                    summary = StepEngine.compute(today: today, counts: last.counts, peaks: loadPeaks(),
                                                 settings: settings, computedAt: computedAt, cal)
                    saveSummary(summary)
                } else if let last = loadSummary() {
                    summary = StepEngine.project(last, to: today, settings: settings, cal)
                } else {
                    summary = StepEngine.compute(today: today, counts: [:], peaks: loadPeaks(),
                                                 settings: settings, computedAt: computedAt, cal)
                }
                logRead(source: source, ok: false, detail: "\(error)")
                completion(summary, nil)
            }
        }
    }
}

private final class Once {
    private var claimed = false
    private let lock = NSLock()
    func claim() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if claimed { return false }
        claimed = true
        return true
    }
}
