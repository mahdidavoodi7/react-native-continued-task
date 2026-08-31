import Foundation

/// Durable storage for `ContinuedTaskRecord`s, backed by `UserDefaults`.
///
/// All access is serialized on one queue; nothing here calls back into JS, so
/// the queue is never held across a listener invocation.
final class ContinuedTaskStore {
  static let shared = ContinuedTaskStore()

  private static let defaultsKey = "com.margelo.continuedtask.records"

  private let queue = DispatchQueue(label: "com.margelo.continuedtask.store")
  private let defaults: UserDefaults

  private init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  /// Marks every record still in a live state as `app-terminated`.
  ///
  /// Called once when the manager is created. Nothing has been submitted in
  /// this process yet, so any record that still looks live must have been
  /// left behind by a previous one.
  func reconcileRecordsFromPreviousLaunch() {
    queue.sync {
      var records = readRecords()
      var didChange = false
      for index in records.indices where records[index].isLive {
        records[index].state = ContinuedTaskState.stopped.stringValue
        records[index].stopReason = TaskStopReason.appTerminated.stringValue
        didChange = true
      }
      if didChange {
        writeRecords(records)
      }
    }
  }

  func insert(_ record: ContinuedTaskRecord) {
    queue.sync {
      var records = readRecords()
      records.removeAll { $0.id == record.id }
      records.append(record)
      writeRecords(records)
    }
  }

  func update(id: String, mutate: (inout ContinuedTaskRecord) -> Void) {
    queue.sync {
      var records = readRecords()
      guard let index = records.firstIndex(where: { $0.id == id }) else {
        return
      }
      mutate(&records[index])
      writeRecords(records)
    }
  }

  /// Every record, newest first.
  func allRecords() -> [ContinuedTaskRecord] {
    return queue.sync {
      return readRecords().sorted { $0.submittedAt > $1.submittedAt }
    }
  }

  func forget(ids: [String]) {
    queue.sync {
      let removable = Set(ids)
      let records = readRecords().filter { !removable.contains($0.id) }
      writeRecords(records)
    }
  }

  // MARK: - Queue-confined storage

  private func readRecords() -> [ContinuedTaskRecord] {
    guard let data = defaults.data(forKey: Self.defaultsKey) else {
      return []
    }
    return (try? JSONDecoder().decode([ContinuedTaskRecord].self, from: data)) ?? []
  }

  private func writeRecords(_ records: [ContinuedTaskRecord]) {
    guard let data = try? JSONEncoder().encode(records) else {
      return
    }
    defaults.set(data, forKey: Self.defaultsKey)
  }
}
