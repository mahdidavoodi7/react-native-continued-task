import BackgroundTasks
import Foundation

/// Process-wide bookkeeping for continued processing tasks.
///
/// This type exists for one reason above all others. Apple: *"Register each
/// task identifier only once. The system kills the app on the second
/// registration of the same task identifier."* `BGTaskScheduler` offers no way
/// to unregister and no way to ask what is already registered, so the set of
/// identifiers this process has registered has to be tracked here, and every
/// registration has to go through `registerIfNeeded`.
///
/// It also keeps a strong reference to each live task handle. The launch
/// handler fires some time after `submit` returns, and it must still find the
/// handle even if JS has dropped its own reference by then.
final class ContinuedTaskRegistry {
  static let shared = ContinuedTaskRegistry()

  private let lock = NSLock()
  private var registeredIdentifiers: Set<String> = []
  private var liveTasks: [String: HybridContinuedTask] = [:]

  private init() {}

  /// Registers a launch handler for `identifier`, at most once per process.
  ///
  /// Returns `false` only when `BGTaskScheduler` rejects the registration,
  /// which means the identifier is not covered by the app's
  /// `BGTaskSchedulerPermittedIdentifiers`. A repeat call for an identifier
  /// this process already registered is a no-op that returns `true` — never a
  /// second `register` call, and never a crash.
  @available(iOS 26.0, *)
  func registerIfNeeded(identifier: String) -> Bool {
    lock.lock()
    if registeredIdentifiers.contains(identifier) {
      lock.unlock()
      return true
    }
    lock.unlock()

    let didRegister = BGTaskScheduler.shared.register(
      forTaskWithIdentifier: identifier,
      using: nil
    ) { [weak self] task in
      guard let continuedTask = task as? BGContinuedProcessingTask else {
        task.setTaskCompleted(success: false)
        return
      }
      guard let handle = self?.task(withIdentifier: continuedTask.identifier) else {
        // Nothing left in this process wants the task; end it rather than
        // letting the system keep the app alive for work nobody owns.
        continuedTask.setTaskCompleted(success: false)
        return
      }
      handle.attach(nativeTask: continuedTask)
    }

    if didRegister {
      lock.lock()
      registeredIdentifiers.insert(identifier)
      lock.unlock()
    }
    return didRegister
  }

  /// Whether this process already registered `identifier`. Test seam.
  func isRegistered(identifier: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    return registeredIdentifiers.contains(identifier)
  }

  func retain(_ task: HybridContinuedTask, forIdentifier identifier: String) {
    lock.lock()
    defer { lock.unlock() }
    liveTasks[identifier] = task
  }

  func release(identifier: String) {
    lock.lock()
    defer { lock.unlock() }
    liveTasks.removeValue(forKey: identifier)
  }

  func task(withIdentifier identifier: String) -> HybridContinuedTask? {
    lock.lock()
    defer { lock.unlock() }
    return liveTasks[identifier]
  }
}
