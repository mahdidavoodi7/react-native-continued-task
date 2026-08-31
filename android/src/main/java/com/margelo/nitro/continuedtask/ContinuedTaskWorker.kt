package com.margelo.nitro.continuedtask

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ForegroundInfo
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Holds a foreground service open for as long as JS is working on a task.
 *
 * Two `CoroutineWorker` constraints shape this class. `getForegroundInfoAsync()`
 * and `onStopped()` are `final`, so the suspend [getForegroundInfo] is
 * overridden instead and coroutine cancellation is the stop signal. And
 * `getForegroundInfo` alone is the *expedited* work path — for long-running
 * work [setForeground] has to be called from inside [doWork], without which a
 * `CoroutineWorker` is capped at ten minutes.
 *
 * `setExpedited` is deliberately not used: expedited work is for short tasks.
 */
class ContinuedTaskWorker(
  context: Context,
  parameters: WorkerParameters
) : CoroutineWorker(context, parameters) {

  private val taskId: String? get() = inputData.getString(KEY_TASK_ID)

  override suspend fun getForegroundInfo(): ForegroundInfo {
    val id = taskId ?: return notificationFor(null).foregroundInfo(
      this.id, "Working", "", 0.0, 0.0
    )
    val task = ContinuedTaskRegistry.task(id)
    return notificationFor(task).foregroundInfo(
      this.id,
      task?.title ?: inputData.getString(KEY_TITLE).orEmpty(),
      task?.subtitle ?: inputData.getString(KEY_SUBTITLE).orEmpty(),
      task?.completedUnitCount ?: 0.0,
      task?.totalUnitCount ?: inputData.getDouble(KEY_TOTAL_UNIT_COUNT, 0.0)
    )
  }

  override suspend fun doWork(): Result {
    val id = taskId ?: return Result.failure()
    val task = resolveTask(id) ?: return abandon(id)

    task.onWorkerStarted(this)
    setForeground(foregroundInfoFor(task))

    return try {
      coroutineScope {
        // Keep the notification in step with whatever JS last reported.
        launch {
          task.displayState.collect { _ -> setForeground(foregroundInfoFor(task)) }
        }
        val success = task.awaitCompletion()
        if (success) Result.success() else Result.failure()
      }
    } catch (cancellation: CancellationException) {
      // The only stop signal available: onStopped() is final on CoroutineWorker.
      task.onWorkerStopped(stopReason)
      throw cancellation
    } finally {
      ContinuedTaskRegistry.cancelAwait(id)
    }
  }

  /**
   * Finds the handle for this work, waiting a bounded time when the process
   * was restarted and JS has not called `attachToTask` yet.
   *
   * The wait is a policy, not a race workaround: it is how long the foreground
   * service is held open for the app to come back before the budget it spends
   * stops being worth it.
   */
  private suspend fun resolveTask(id: String): HybridContinuedTask? {
    ContinuedTaskRegistry.task(id)?.let { return it }
    return withTimeoutOrNull(ATTACH_TIMEOUT_MS) {
      ContinuedTaskRegistry.awaitAttachment(id).await()
    }
  }

  private fun abandon(id: String): Result {
    ContinuedTaskRegistry.cancelAwait(id)
    ContinuedTaskStore(applicationContext).update(id) { record ->
      record.state = ContinuedTaskRecord.stateName(ContinuedTaskState.STOPPED)
      record.stopReason = ContinuedTaskRecord.stopReasonName(TaskStopReason.APP_TERMINATED)
    }
    return Result.failure()
  }

  private fun foregroundInfoFor(task: HybridContinuedTask): ForegroundInfo =
    notificationFor(task).foregroundInfo(
      id,
      task.title,
      task.subtitle,
      task.completedUnitCount,
      task.totalUnitCount
    )

  private fun notificationFor(task: HybridContinuedTask?) =
    ContinuedTaskNotification(applicationContext, task?.androidOptions)

  /** Mirrors progress into `WorkInfo`, observable through `getWorkInfoByIdFlow`. */
  suspend fun publishProgress(completedUnitCount: Double, totalUnitCount: Double) {
    setProgress(progressData(completedUnitCount, totalUnitCount))
  }

  companion object {
    const val KEY_TASK_ID = "continuedTaskId"
    const val KEY_TITLE = "title"
    const val KEY_SUBTITLE = "subtitle"
    const val KEY_TOTAL_UNIT_COUNT = "totalUnitCount"
    const val KEY_COMPLETED_UNIT_COUNT = "completedUnitCount"

    private const val ATTACH_TIMEOUT_MS = 30_000L

    fun inputData(
      taskId: String,
      title: String,
      subtitle: String,
      totalUnitCount: Double
    ): Data = workDataOf(
      KEY_TASK_ID to taskId,
      KEY_TITLE to title,
      KEY_SUBTITLE to subtitle,
      KEY_TOTAL_UNIT_COUNT to totalUnitCount
    )

    fun progressData(completedUnitCount: Double, totalUnitCount: Double): Data = workDataOf(
      KEY_COMPLETED_UNIT_COUNT to completedUnitCount,
      KEY_TOTAL_UNIT_COUNT to totalUnitCount
    )
  }
}
