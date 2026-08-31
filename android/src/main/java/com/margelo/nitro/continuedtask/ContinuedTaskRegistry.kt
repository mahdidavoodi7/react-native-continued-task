package com.margelo.nitro.continuedtask

import kotlinx.coroutines.CompletableDeferred
import java.util.concurrent.ConcurrentHashMap

/**
 * Process-wide link between the JS-facing [HybridContinuedTask] handles and
 * the [ContinuedTaskWorker] coroutines running the foreground service.
 *
 * WorkManager runs workers in the app process, so the worker can find its
 * handle here rather than passing state through `Data`. A worker restarted
 * after process death finds nothing and waits to be attached to.
 */
object ContinuedTaskRegistry {

  private val tasks = ConcurrentHashMap<String, HybridContinuedTask>()
  private val waiters = ConcurrentHashMap<String, CompletableDeferred<HybridContinuedTask>>()

  fun retain(id: String, task: HybridContinuedTask) {
    tasks[id] = task
    // A worker already running for this id has been waiting for JS to come
    // back; hand it the freshly attached handle.
    waiters.remove(id)?.complete(task)
  }

  fun release(id: String) {
    tasks.remove(id)
  }

  fun task(id: String): HybridContinuedTask? = tasks[id]

  /**
   * The deferred a restarted worker awaits until JS calls `attachToTask` for
   * this id. Completed by [retain].
   */
  fun awaitAttachment(id: String): CompletableDeferred<HybridContinuedTask> =
    waiters.getOrPut(id) { CompletableDeferred() }

  fun cancelAwait(id: String) {
    waiters.remove(id)
  }
}
