package com.margelo.nitro.continuedtask

import androidx.work.WorkInfo

/**
 * Maps WorkManager's stop reasons onto the library's [TaskStopReason].
 *
 * Kept as a pure function with no Android dependencies beyond the constants
 * themselves, because provoking a real [WorkInfo.STOP_REASON_QUOTA] or a
 * six-hour [WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT] in a test is
 * impractical, while getting the mapping wrong is easy. The values are
 * referenced symbolically rather than written out: several are negative
 * (`STOP_REASON_FOREGROUND_SERVICE_TIMEOUT` is -128, `STOP_REASON_UNKNOWN` is
 * -512) and hardcoding them invites a silent drift.
 */
object TaskStopReasons {

  /** The normalized reason for a raw WorkManager stop reason. */
  fun fromWorkManagerStopReason(stopReason: Int): TaskStopReason =
    when (stopReason) {
      WorkInfo.STOP_REASON_CANCELLED_BY_APP -> TaskStopReason.APP_CANCELLED
      WorkInfo.STOP_REASON_USER -> TaskStopReason.USER_CANCELLED
      WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT -> TaskStopReason.FGS_TIMEOUT
      WorkInfo.STOP_REASON_QUOTA -> TaskStopReason.QUOTA
      WorkInfo.STOP_REASON_TIMEOUT,
      WorkInfo.STOP_REASON_PREEMPT,
      WorkInfo.STOP_REASON_DEVICE_STATE,
      WorkInfo.STOP_REASON_BACKGROUND_RESTRICTION,
      WorkInfo.STOP_REASON_APP_STANDBY,
      WorkInfo.STOP_REASON_SYSTEM_PROCESSING,
      WorkInfo.STOP_REASON_ESTIMATED_APP_LAUNCH_TIME_CHANGED,
      WorkInfo.STOP_REASON_CONSTRAINT_BATTERY_NOT_LOW,
      WorkInfo.STOP_REASON_CONSTRAINT_CHARGING,
      WorkInfo.STOP_REASON_CONSTRAINT_CONNECTIVITY,
      WorkInfo.STOP_REASON_CONSTRAINT_DEVICE_IDLE,
      WorkInfo.STOP_REASON_CONSTRAINT_STORAGE_NOT_LOW -> TaskStopReason.EXPIRED
      else -> TaskStopReason.UNKNOWN
    }

  /**
   * WorkManager's own name for a stop reason, carried to JS in
   * [NativeStopDetail.name] so a reason that normalizes to `unknown` is still
   * identifiable in a bug report.
   */
  fun nameFor(stopReason: Int): String =
    when (stopReason) {
      WorkInfo.STOP_REASON_NOT_STOPPED -> "STOP_REASON_NOT_STOPPED"
      WorkInfo.STOP_REASON_UNKNOWN -> "STOP_REASON_UNKNOWN"
      WorkInfo.STOP_REASON_CANCELLED_BY_APP -> "STOP_REASON_CANCELLED_BY_APP"
      WorkInfo.STOP_REASON_PREEMPT -> "STOP_REASON_PREEMPT"
      WorkInfo.STOP_REASON_TIMEOUT -> "STOP_REASON_TIMEOUT"
      WorkInfo.STOP_REASON_DEVICE_STATE -> "STOP_REASON_DEVICE_STATE"
      WorkInfo.STOP_REASON_CONSTRAINT_BATTERY_NOT_LOW -> "STOP_REASON_CONSTRAINT_BATTERY_NOT_LOW"
      WorkInfo.STOP_REASON_CONSTRAINT_CHARGING -> "STOP_REASON_CONSTRAINT_CHARGING"
      WorkInfo.STOP_REASON_CONSTRAINT_CONNECTIVITY -> "STOP_REASON_CONSTRAINT_CONNECTIVITY"
      WorkInfo.STOP_REASON_CONSTRAINT_DEVICE_IDLE -> "STOP_REASON_CONSTRAINT_DEVICE_IDLE"
      WorkInfo.STOP_REASON_CONSTRAINT_STORAGE_NOT_LOW -> "STOP_REASON_CONSTRAINT_STORAGE_NOT_LOW"
      WorkInfo.STOP_REASON_QUOTA -> "STOP_REASON_QUOTA"
      WorkInfo.STOP_REASON_BACKGROUND_RESTRICTION -> "STOP_REASON_BACKGROUND_RESTRICTION"
      WorkInfo.STOP_REASON_APP_STANDBY -> "STOP_REASON_APP_STANDBY"
      WorkInfo.STOP_REASON_USER -> "STOP_REASON_USER"
      WorkInfo.STOP_REASON_SYSTEM_PROCESSING -> "STOP_REASON_SYSTEM_PROCESSING"
      WorkInfo.STOP_REASON_ESTIMATED_APP_LAUNCH_TIME_CHANGED ->
        "STOP_REASON_ESTIMATED_APP_LAUNCH_TIME_CHANGED"
      WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT ->
        "STOP_REASON_FOREGROUND_SERVICE_TIMEOUT"
      else -> "STOP_REASON_$stopReason"
    }
}
