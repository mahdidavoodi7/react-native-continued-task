package com.margelo.nitro.continuedtask

import android.content.Context
import androidx.annotation.Keep
import androidx.work.WorkManager
import com.facebook.proguard.annotations.DoNotStrip
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * A live handle to one WorkManager task running as a foreground service.
 *
 * The handle is created by the manager at submit time and paired with its
 * [ContinuedTaskWorker] through [ContinuedTaskRegistry] once the worker starts.
 */
@DoNotStrip
@Keep
class HybridContinuedTask(
  private val context: Context,
  private val identifier: String,
  private val workId: UUID,
  private val store: ContinuedTaskStore,
  initialTitle: String,
  initialSubtitle: String,
  initialTotalUnitCount: Double,
  internal val androidOptions: AndroidTaskOptions?
) : HybridContinuedTaskSpec() {

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private val completion = CompletableDeferred<Boolean>()
  private val startListeners = ConcurrentHashMap<Int, () -> Unit>()
  private val stopListeners = ConcurrentHashMap<Int, (TaskStopEvent) -> Unit>()
  private val nextListenerId = AtomicInteger(0)

  private val display = MutableStateFlow(
    TaskDisplayState(initialTitle, initialSubtitle, 0.0, initialTotalUnitCount)
  )

  /** Observed by the worker to keep the notification current. */
  internal val displayState: StateFlow<TaskDisplayState> get() = display

  @Volatile
  private var currentState: ContinuedTaskState = ContinuedTaskState.PENDING

  @Volatile
  private var worker: ContinuedTaskWorker? = null

  override val id: String get() = identifier
  override val title: String get() = display.value.title
  override val subtitle: String get() = display.value.subtitle
  override val state: ContinuedTaskState get() = currentState
  override val completedUnitCount: Double get() = display.value.completedUnitCount
  override val totalUnitCount: Double get() = display.value.totalUnitCount

  override fun updateTitle(title: String, subtitle: String) {
    display.value = display.value.copy(title = title, subtitle = subtitle)
    store.update(identifier) { record ->
      record.title = title
      record.subtitle = subtitle
    }
  }

  override fun setProgress(completedUnitCount: Double, totalUnitCount: Double) {
    val total = maxOf(totalUnitCount, 0.0)
    val completed = minOf(maxOf(completedUnitCount, 0.0), total)
    display.value = display.value.copy(
      completedUnitCount = completed,
      totalUnitCount = total
    )
    store.update(identifier) { record ->
      record.completedUnitCount = completed
      record.totalUnitCount = total
    }
    val activeWorker = worker
    if (activeWorker != null) {
      scope.launch { activeWorker.publishProgress(completed, total) }
    }
  }

  override fun complete(success: Boolean) {
    if (currentState != ContinuedTaskState.PENDING && currentState != ContinuedTaskState.RUNNING) {
      return
    }
    currentState = ContinuedTaskState.FINISHED
    store.update(identifier) { record ->
      record.state = ContinuedTaskRecord.stateName(ContinuedTaskState.FINISHED)
    }
    ContinuedTaskRegistry.release(identifier)
    completion.complete(success)
  }

  override fun cancel() {
    if (currentState != ContinuedTaskState.PENDING && currentState != ContinuedTaskState.RUNNING) {
      return
    }
    // Cancelling the work stops the worker, whose cancellation handler reports
    // STOP_REASON_CANCELLED_BY_APP back through onWorkerStopped.
    WorkManager.getInstance(context).cancelWorkById(workId)
    if (worker == null) {
      // Never started, so no worker will report the stop.
      emitStop(TaskStopReason.APP_CANCELLED, WorkManagerStopReasons.CANCELLED_BY_APP_NAME, null)
    }
  }

  override fun addOnStartListener(listener: () -> Unit): ListenerSubscription {
    if (currentState == ContinuedTaskState.RUNNING) {
      // Replay for a task that started before this listener was added.
      listener()
      return ListenerSubscription(Func_void {})
    }
    val listenerId = nextListenerId.getAndIncrement()
    startListeners[listenerId] = listener
    return ListenerSubscription(Func_void { startListeners.remove(listenerId) })
  }

  override fun addOnStopListener(listener: (event: TaskStopEvent) -> Unit): ListenerSubscription {
    val listenerId = nextListenerId.getAndIncrement()
    stopListeners[listenerId] = listener
    return ListenerSubscription(Func_void { stopListeners.remove(listenerId) })
  }

  // MARK: - Worker callbacks

  internal fun onWorkerStarted(startedWorker: ContinuedTaskWorker) {
    worker = startedWorker
    if (currentState != ContinuedTaskState.PENDING) return
    currentState = ContinuedTaskState.RUNNING
    store.update(identifier) { record ->
      record.state = ContinuedTaskRecord.stateName(ContinuedTaskState.RUNNING)
    }
    val listeners = startListeners.values.toList()
    startListeners.clear()
    listeners.forEach { it() }
  }

  internal suspend fun awaitCompletion(): Boolean = completion.await()

  internal fun onWorkerStopped(stopReason: Int) {
    emitStop(
      TaskStopReasons.fromWorkManagerStopReason(stopReason),
      TaskStopReasons.nameFor(stopReason),
      stopReason.toDouble()
    )
  }

  private fun emitStop(reason: TaskStopReason, name: String, code: Double?) {
    if (currentState != ContinuedTaskState.PENDING && currentState != ContinuedTaskState.RUNNING) {
      return
    }
    currentState = ContinuedTaskState.STOPPED
    store.update(identifier) { record ->
      record.state = ContinuedTaskRecord.stateName(ContinuedTaskState.STOPPED)
      record.stopReason = ContinuedTaskRecord.stopReasonName(reason)
    }
    ContinuedTaskRegistry.release(identifier)
    startListeners.clear()

    val event = TaskStopEvent(
      taskId = identifier,
      reason = reason,
      native = NativeStopDetail(domain = "WorkManager", code = code, name = name)
    )
    val listeners = stopListeners.values.toList()
    listeners.forEach { it(event) }
    completion.complete(false)
  }
}
