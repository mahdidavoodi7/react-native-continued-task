import BackgroundTasks
import Foundation
import NitroModules

/// A live handle to one `BGContinuedProcessingTask`.
///
/// The handle is created at submit time and starts in the `pending` state. The
/// system's launch handler fires some time later and calls `attach`, which is
/// the moment the task is really running.
///
/// Mutable state is guarded by a narrow lock because JS reads the properties
/// synchronously on the JS thread while `BGTaskScheduler` invokes the
/// expiration handler on a queue of its choosing. The lock is never held while
/// a listener is invoked.
@available(iOS 26.0, *)
final class HybridContinuedTask: HybridContinuedTaskSpec {
  private let lock = NSLock()

  private let identifier: String
  private var currentTitle: String
  private var currentSubtitle: String
  private var currentState: ContinuedTaskState = .pending
  private var currentCompletedUnitCount: Double = 0
  private var currentTotalUnitCount: Double

  private var nativeTask: BGContinuedProcessingTask?
  private var startListeners: [Int: () -> Void] = [:]
  private var stopListeners: [Int: (TaskStopEvent) -> Void] = [:]
  private var nextListenerId = 0

  init(identifier: String, title: String, subtitle: String, totalUnitCount: Double) {
    self.identifier = identifier
    self.currentTitle = title
    self.currentSubtitle = subtitle
    self.currentTotalUnitCount = totalUnitCount
  }

  // MARK: - Spec properties

  var id: String { identifier }

  var title: String {
    lock.lock()
    defer { lock.unlock() }
    return currentTitle
  }

  var subtitle: String {
    lock.lock()
    defer { lock.unlock() }
    return currentSubtitle
  }

  var state: ContinuedTaskState {
    lock.lock()
    defer { lock.unlock() }
    return currentState
  }

  var completedUnitCount: Double {
    lock.lock()
    defer { lock.unlock() }
    return currentCompletedUnitCount
  }

  var totalUnitCount: Double {
    lock.lock()
    defer { lock.unlock() }
    return currentTotalUnitCount
  }

  // MARK: - Spec methods

  func updateTitle(title: String, subtitle: String) throws {
    lock.lock()
    currentTitle = title
    currentSubtitle = subtitle
    let task = nativeTask
    lock.unlock()

    task?.updateTitle(title, subtitle: subtitle)
    ContinuedTaskStore.shared.update(id: identifier) { record in
      record.title = title
      record.subtitle = subtitle
    }
  }

  func setProgress(completedUnitCount: Double, totalUnitCount: Double) throws {
    let total = max(totalUnitCount, 0)
    let completed = min(max(completedUnitCount, 0), total)

    lock.lock()
    currentCompletedUnitCount = completed
    currentTotalUnitCount = total
    let task = nativeTask
    lock.unlock()

    if let progress = task?.progress {
      progress.totalUnitCount = Int64(total)
      progress.completedUnitCount = Int64(completed)
    }
    ContinuedTaskStore.shared.update(id: identifier) { record in
      record.completedUnitCount = completed
      record.totalUnitCount = total
    }
  }

  func complete(success: Bool) throws {
    lock.lock()
    guard currentState == .pending || currentState == .running else {
      lock.unlock()
      return
    }
    currentState = .finished
    let task = nativeTask
    nativeTask = nil
    lock.unlock()

    task?.setTaskCompleted(success: success)
    ContinuedTaskStore.shared.update(id: identifier) { record in
      record.state = ContinuedTaskState.finished.stringValue
    }
    ContinuedTaskRegistry.shared.release(identifier: identifier)
  }

  func cancel() throws {
    lock.lock()
    guard currentState == .pending || currentState == .running else {
      lock.unlock()
      return
    }
    let wasPending = currentState == .pending
    let task = nativeTask
    lock.unlock()

    if wasPending {
      // Still queued: withdraw the request before the system launches it.
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier)
    }
    task?.setTaskCompleted(success: false)

    stop(
      reason: .appCancelled,
      detail: NativeStopDetail(domain: "BGTaskScheduler", code: nil, name: "cancel")
    )
  }

  func addOnStartListener(listener: @escaping () -> Void) throws -> ListenerSubscription {
    lock.lock()
    let listenerId = nextListenerId
    nextListenerId += 1
    let isAlreadyRunning = currentState == .running
    if !isAlreadyRunning {
      startListeners[listenerId] = listener
    }
    lock.unlock()

    // Replay for a task that started before this listener was added, so there
    // is no race between submitting and subscribing.
    if isAlreadyRunning {
      listener()
      return ListenerSubscription(remove: {})
    }
    return ListenerSubscription(remove: { [weak self] in
      guard let self else { return }
      self.lock.lock()
      self.startListeners.removeValue(forKey: listenerId)
      self.lock.unlock()
    })
  }

  func addOnStopListener(
    listener: @escaping (TaskStopEvent) -> Void
  ) throws -> ListenerSubscription {
    lock.lock()
    let listenerId = nextListenerId
    nextListenerId += 1
    stopListeners[listenerId] = listener
    lock.unlock()

    return ListenerSubscription(remove: { [weak self] in
      guard let self else { return }
      self.lock.lock()
      self.stopListeners.removeValue(forKey: listenerId)
      self.lock.unlock()
    })
  }

  // MARK: - System callbacks

  /// Called from the scheduler's launch handler when the task actually starts.
  func attach(nativeTask task: BGContinuedProcessingTask) {
    lock.lock()
    guard currentState == .pending else {
      lock.unlock()
      task.setTaskCompleted(success: false)
      return
    }
    nativeTask = task
    currentState = .running
    let completed = currentCompletedUnitCount
    let total = currentTotalUnitCount
    let listeners = Array(startListeners.values)
    startListeners.removeAll()
    lock.unlock()

    task.progress.totalUnitCount = Int64(total)
    task.progress.completedUnitCount = Int64(completed)
    task.expirationHandler = { [weak self] in
      // iOS routes both user cancellation from the Live Activity and system
      // expiration through this one handler, with nothing to tell them apart,
      // so this reports the reason it can actually justify.
      self?.stop(
        reason: .expired,
        detail: NativeStopDetail(
          domain: "BGTaskScheduler",
          code: nil,
          name: "expirationHandler"
        )
      )
    }

    ContinuedTaskStore.shared.update(id: identifier) { record in
      record.state = ContinuedTaskState.running.stringValue
    }
    listeners.forEach { $0() }
  }

  private func stop(reason: TaskStopReason, detail: NativeStopDetail) {
    lock.lock()
    guard currentState == .pending || currentState == .running else {
      lock.unlock()
      return
    }
    currentState = .stopped
    nativeTask = nil
    let listeners = Array(stopListeners.values)
    startListeners.removeAll()
    lock.unlock()

    ContinuedTaskStore.shared.update(id: identifier) { record in
      record.state = ContinuedTaskState.stopped.stringValue
      record.stopReason = reason.stringValue
    }
    ContinuedTaskRegistry.shared.release(identifier: identifier)

    let event = TaskStopEvent(taskId: identifier, reason: reason, native: detail)
    listeners.forEach { $0(event) }
  }
}
