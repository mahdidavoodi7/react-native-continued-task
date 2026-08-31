package com.margelo.nitro.continuedtask

import android.content.Context
import org.json.JSONArray

/**
 * Durable storage for [ContinuedTaskRecord]s, backed by SharedPreferences.
 *
 * Android can restart a worker after the app process dies, so a record here
 * may describe work that is genuinely still running — unlike on iOS, where a
 * live-looking record always means the task was cancelled.
 */
class ContinuedTaskStore(context: Context) {

  private val preferences =
    context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
  private val lock = Any()

  /**
   * Marks records left live by a previous process as `app-terminated`, unless
   * WorkManager still has the work running.
   *
   * @param stillRunningIds ids WorkManager reports as live right now, which
   *   should keep their state instead of being reported as orphans.
   */
  fun reconcileRecordsFromPreviousLaunch(stillRunningIds: Set<String>) = synchronized(lock) {
    val records = readRecords()
    var didChange = false
    for (record in records) {
      if (record.isLive && !stillRunningIds.contains(record.id)) {
        record.state = ContinuedTaskRecord.stateName(ContinuedTaskState.STOPPED)
        record.stopReason = ContinuedTaskRecord.stopReasonName(TaskStopReason.APP_TERMINATED)
        didChange = true
      }
    }
    if (didChange) writeRecords(records)
  }

  fun insert(record: ContinuedTaskRecord) = synchronized(lock) {
    val records = readRecords().filterNot { it.id == record.id }.toMutableList()
    records.add(record)
    writeRecords(records)
  }

  fun update(id: String, mutate: (ContinuedTaskRecord) -> Unit) = synchronized(lock) {
    val records = readRecords()
    val record = records.firstOrNull { it.id == id } ?: return@synchronized
    mutate(record)
    writeRecords(records)
  }

  /** Every record, newest first. */
  fun allRecords(): List<ContinuedTaskRecord> = synchronized(lock) {
    readRecords().sortedByDescending { it.submittedAt }
  }

  fun find(id: String): ContinuedTaskRecord? = synchronized(lock) {
    readRecords().firstOrNull { it.id == id }
  }

  fun forget(ids: List<String>) = synchronized(lock) {
    val removable = ids.toSet()
    writeRecords(readRecords().filterNot { removable.contains(it.id) })
  }

  private fun readRecords(): MutableList<ContinuedTaskRecord> {
    val raw = preferences.getString(RECORDS_KEY, null) ?: return mutableListOf()
    return runCatching {
      val array = JSONArray(raw)
      (0 until array.length())
        .map { ContinuedTaskRecord.fromJson(array.getJSONObject(it)) }
        .toMutableList()
    }.getOrElse { mutableListOf() }
  }

  private fun writeRecords(records: List<ContinuedTaskRecord>) {
    val array = JSONArray()
    records.forEach { array.put(it.toJson()) }
    preferences.edit().putString(RECORDS_KEY, array.toString()).apply()
  }

  private companion object {
    const val PREFERENCES_NAME = "com.margelo.continuedtask"
    const val RECORDS_KEY = "records"
  }
}
