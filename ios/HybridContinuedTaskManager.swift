import BackgroundTasks
import Foundation
import NitroModules

/// The autolinked root object: submits continued processing tasks and reads
/// back what a previous process left behind.
final class HybridContinuedTaskManager: HybridContinuedTaskManagerSpec {
  private let queue = DispatchQueue(label: "com.margelo.continuedtask.manager")

  override init() {
    super.init()
    // Anything still marked live was left by a previous process, because
    // nothing has been submitted in this one yet.
    ContinuedTaskStore.shared.reconcileRecordsFromPreviousLaunch()
  }

  var isSupported: Bool {
    if #available(iOS 26.0, *) {
      return true
    }
    return false
  }

  var supportsGPU: Bool {
    if #available(iOS 26.0, *) {
      return BGTaskScheduler.supportedResources.contains(.gpu)
    }
    return false
  }

  /// iOS cancels continued processing tasks when the app is terminated, so
  /// there is never a live task to re-attach to.
  var supportsReattach: Bool { false }

  func submit(options: ContinuedTaskOptions) throws -> Promise<any HybridContinuedTaskSpec> {
    // Validated synchronously, while the JS thread is still blocked, so bad
    // input throws at the call site instead of rejecting later.
    guard #available(iOS 26.0, *) else {
      throw SubmitError.unsupportedPlatform(
        "Continued processing tasks require iOS 26 or newer."
      )
    }
    guard options.totalUnitCount > 0 else {
      throw SubmitError.invalidOptions(
        "totalUnitCount must be greater than 0; progress reporting is what keeps the task alive."
      )
    }
    try Bundle.main.validateContinuedTaskPrefix(options.identifierPrefix)

    let identifier = "\(options.identifierPrefix).\(UUID().uuidString)"
    let request = try options.toTaskRequest(identifier: identifier)

    let task = HybridContinuedTask(
      identifier: identifier,
      title: options.title,
      subtitle: options.subtitle,
      totalUnitCount: options.totalUnitCount
    )

    return Promise.parallel(queue) {
      guard ContinuedTaskRegistry.shared.registerIfNeeded(identifier: identifier) else {
        throw SubmitError.notPermitted(
          "BGTaskScheduler refused to register '\(identifier)'. Its wildcard form '\(options.identifierPrefix).*' must be in BGTaskSchedulerPermittedIdentifiers."
        )
      }

      // Retained before submitting: the launch handler can fire the moment
      // the request lands, and it has to find this handle.
      ContinuedTaskRegistry.shared.retain(task, forIdentifier: identifier)
      ContinuedTaskStore.shared.insert(
        ContinuedTaskRecord(
          id: identifier,
          identifierPrefix: options.identifierPrefix,
          title: options.title,
          subtitle: options.subtitle,
          totalUnitCount: options.totalUnitCount
        )
      )

      do {
        try ContinuedTaskSubmitter.submit(request)
      } catch {
        ContinuedTaskRegistry.shared.release(identifier: identifier)
        ContinuedTaskStore.shared.forget(ids: [identifier])
        throw error
      }

      return task
    }
  }

  func getKnownTasks() throws -> Promise<[KnownTask]> {
    return Promise.parallel(queue) {
      return ContinuedTaskStore.shared.allRecords().map { $0.toKnownTask() }
    }
  }

  /// Always resolves to `nil` on iOS. See ``supportsReattach``.
  func attachToTask(id: String) throws -> Promise<(any HybridContinuedTaskSpec)?> {
    return Promise.resolved(withResult: nil)
  }

  func forgetTasks(ids: [String]) throws -> Promise<Void> {
    return Promise.parallel(queue) {
      ContinuedTaskStore.shared.forget(ids: ids)
    }
  }
}
