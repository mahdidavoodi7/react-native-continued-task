package com.margelo.nitro.continuedtask

import android.content.Context
import androidx.annotation.Keep
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.margelo.nitro.core.Promise
import java.util.UUID

/**
 * The autolinked root object: enqueues foreground-service work and reads back
 * what a previous process left behind.
 */
@DoNotStrip
@Keep
class HybridContinuedTaskManager : HybridContinuedTaskManagerSpec() {

  private val context: Context
    get() = NitroModules.applicationContext
      ?: throw IllegalStateException(
        "NitroModules.applicationContext is null. react-native-continued-task needs an Android Context."
      )

  private val store: ContinuedTaskStore by lazy { ContinuedTaskStore(context) }

  override val isSupported: Boolean get() = true

  /** iOS-only capability; there is no Android equivalent of a GPU resource request. */
  override val supportsGPU: Boolean get() = false

  /** A WorkManager worker outlives the app process, so re-attaching is real here. */
  override val supportsReattach: Boolean get() = true

  override fun submit(options: ContinuedTaskOptions): Promise<HybridContinuedTaskSpec> {
    // Validated synchronously, while the JS thread is still blocked.
    if (options.identifierPrefix.isEmpty()) {
      throw SubmitException.invalidIdentifier("identifierPrefix must not be empty.")
    }
    if (options.identifierPrefix.endsWith(".*")) {
      throw SubmitException.invalidIdentifier(
        "identifierPrefix must be written without its trailing '.*'."
      )
    }
    if (options.totalUnitCount <= 0) {
      throw SubmitException.invalidOptions(
        "totalUnitCount must be greater than 0; progress reporting is what keeps the task alive."
      )
    }

    val identifier = "${options.identifierPrefix}.${UUID.randomUUID()}"

    return Promise.async {
      val request = OneTimeWorkRequestBuilder<ContinuedTaskWorker>()
        .setInputData(
          ContinuedTaskWorker.inputData(
            identifier,
            options.title,
            options.subtitle,
            options.totalUnitCount
          )
        )
        .addTag(options.identifierPrefix)
        .addTag(identifier)
        .build()

      val task = HybridContinuedTask(
        context = context,
        identifier = identifier,
        workId = request.id,
        store = store,
        initialTitle = options.title,
        initialSubtitle = options.subtitle,
        initialTotalUnitCount = options.totalUnitCount,
        androidOptions = options.android
      )

      // Retained before enqueueing: the worker can start immediately and has
      // to find this handle.
      ContinuedTaskRegistry.retain(identifier, task)
      store.insert(
        ContinuedTaskRecord.create(
          id = identifier,
          identifierPrefix = options.identifierPrefix,
          title = options.title,
          subtitle = options.subtitle,
          totalUnitCount = options.totalUnitCount
        )
      )

      try {
        WorkManager.getInstance(context)
          .enqueueUniqueWork(identifier, ExistingWorkPolicy.KEEP, request)
      } catch (error: Throwable) {
        ContinuedTaskRegistry.release(identifier)
        store.forget(listOf(identifier))
        throw SubmitException.foregroundServiceUnavailable(
          error.message ?: "WorkManager refused the request."
        )
      }

      task as HybridContinuedTaskSpec
    }
  }

  override fun getKnownTasks(): Promise<Array<KnownTask>> = Promise.async {
    store.reconcileRecordsFromPreviousLaunch(runningWorkIdentifiers())
    store.allRecords().map { it.toKnownTask() }.toTypedArray()
  }

  override fun attachToTask(id: String): Promise<HybridContinuedTaskSpec?> = Promise.async {
    ContinuedTaskRegistry.task(id)?.let { return@async it as HybridContinuedTaskSpec }

    val record = store.find(id) ?: return@async null
    val workInfo = WorkManager.getInstance(context)
      .getWorkInfosByTag(id)
      .get()
      .firstOrNull { !it.state.isFinished }
      ?: return@async null

    val task = HybridContinuedTask(
      context = context,
      identifier = id,
      workId = workInfo.id,
      store = store,
      initialTitle = record.title,
      initialSubtitle = record.subtitle,
      initialTotalUnitCount = record.totalUnitCount,
      androidOptions = null
    )
    // Hands the waiting worker its handle back.
    ContinuedTaskRegistry.retain(id, task)
    task as HybridContinuedTaskSpec
  }

  override fun forgetTasks(ids: Array<String>): Promise<Unit> = Promise.async {
    store.forget(ids.toList())
  }

  /** Task identifiers WorkManager still reports as live. */
  private fun runningWorkIdentifiers(): Set<String> = runCatching {
    WorkManager.getInstance(context)
      .getWorkInfos(
        androidx.work.WorkQuery.Builder
          .fromStates(listOf(WorkInfo.State.ENQUEUED, WorkInfo.State.RUNNING))
          .build()
      )
      .get()
      .flatMap { it.tags }
      .toSet()
  }.getOrElse { emptySet() }
}
