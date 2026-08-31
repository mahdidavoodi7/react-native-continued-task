package com.margelo.nitro.continuedtask

import org.json.JSONObject

/**
 * The persisted shape of one submitted task, so work interrupted by process
 * death can be reconciled on the next launch.
 *
 * Serialized with [org.json.JSONObject] rather than a serialization library to
 * keep the library's transitive dependencies to WorkManager alone.
 */
data class ContinuedTaskRecord(
  val id: String,
  val identifierPrefix: String,
  var title: String,
  var subtitle: String,
  val submittedAt: Double,
  var state: String,
  var completedUnitCount: Double,
  var totalUnitCount: Double,
  var stopReason: String? = null
) {

  /** Whether the record was still live when last written. */
  val isLive: Boolean
    get() = state == ContinuedTaskState.PENDING.name.lowercase() ||
      state == ContinuedTaskState.RUNNING.name.lowercase()

  fun toKnownTask(): KnownTask = KnownTask(
    id = id,
    identifierPrefix = identifierPrefix,
    title = title,
    subtitle = subtitle,
    submittedAt = submittedAt,
    state = stateFromString(state),
    completedUnitCount = completedUnitCount,
    totalUnitCount = totalUnitCount,
    stopReason = stopReason?.let { stopReasonFromString(it) }
  )

  fun toJson(): JSONObject = JSONObject().apply {
    put("id", id)
    put("identifierPrefix", identifierPrefix)
    put("title", title)
    put("subtitle", subtitle)
    put("submittedAt", submittedAt)
    put("state", state)
    put("completedUnitCount", completedUnitCount)
    put("totalUnitCount", totalUnitCount)
    put("stopReason", stopReason ?: JSONObject.NULL)
  }

  companion object {
    fun create(
      id: String,
      identifierPrefix: String,
      title: String,
      subtitle: String,
      totalUnitCount: Double
    ): ContinuedTaskRecord = ContinuedTaskRecord(
      id = id,
      identifierPrefix = identifierPrefix,
      title = title,
      subtitle = subtitle,
      submittedAt = System.currentTimeMillis().toDouble(),
      state = ContinuedTaskState.PENDING.name.lowercase(),
      completedUnitCount = 0.0,
      totalUnitCount = totalUnitCount
    )

    fun fromJson(json: JSONObject): ContinuedTaskRecord = ContinuedTaskRecord(
      id = json.getString("id"),
      identifierPrefix = json.getString("identifierPrefix"),
      title = json.getString("title"),
      subtitle = json.getString("subtitle"),
      submittedAt = json.getDouble("submittedAt"),
      state = json.getString("state"),
      completedUnitCount = json.getDouble("completedUnitCount"),
      totalUnitCount = json.getDouble("totalUnitCount"),
      stopReason = if (json.isNull("stopReason")) null else json.getString("stopReason")
    )

    /** The JS spelling of a state, e.g. `RUNNING` -> `running`. */
    fun stateName(state: ContinuedTaskState): String = state.name.lowercase()

    /** The JS spelling of a stop reason, e.g. `FGS_TIMEOUT` -> `fgs-timeout`. */
    fun stopReasonName(reason: TaskStopReason): String =
      reason.name.lowercase().replace('_', '-')

    private fun stateFromString(value: String): ContinuedTaskState =
      ContinuedTaskState.entries.firstOrNull { stateName(it) == value }
        ?: ContinuedTaskState.STOPPED

    private fun stopReasonFromString(value: String): TaskStopReason =
      TaskStopReason.entries.firstOrNull { stopReasonName(it) == value }
        ?: TaskStopReason.UNKNOWN
  }
}
