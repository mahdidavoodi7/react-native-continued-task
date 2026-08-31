import Foundation

/// The persisted shape of one submitted task.
///
/// Records outlive the process on purpose. iOS gives the app no indication
/// when the user swipes it out of the app switcher — the continued processing
/// task is cancelled and nothing is called — so a record left behind in a
/// live state is the only evidence that work was interrupted that way.
struct ContinuedTaskRecord: Codable {
  let id: String
  let identifierPrefix: String
  var title: String
  var subtitle: String
  let submittedAt: Double
  var state: String
  var completedUnitCount: Double
  var totalUnitCount: Double
  var stopReason: String?

  init(
    id: String,
    identifierPrefix: String,
    title: String,
    subtitle: String,
    totalUnitCount: Double
  ) {
    self.id = id
    self.identifierPrefix = identifierPrefix
    self.title = title
    self.subtitle = subtitle
    self.submittedAt = Date().timeIntervalSince1970 * 1000
    self.state = ContinuedTaskState.pending.stringValue
    self.completedUnitCount = 0
    self.totalUnitCount = totalUnitCount
    self.stopReason = nil
  }

  /// Whether this record was still live when it was last written, which after
  /// a process restart means the app went away mid-task.
  var isLive: Bool {
    return state == ContinuedTaskState.pending.stringValue
      || state == ContinuedTaskState.running.stringValue
  }

  func toKnownTask() -> KnownTask {
    return KnownTask(
      id: id,
      identifierPrefix: identifierPrefix,
      title: title,
      subtitle: subtitle,
      submittedAt: submittedAt,
      state: ContinuedTaskState(fromString: state) ?? .stopped,
      completedUnitCount: completedUnitCount,
      totalUnitCount: totalUnitCount,
      stopReason: stopReason.flatMap { TaskStopReason(fromString: $0) }
    )
  }
}
