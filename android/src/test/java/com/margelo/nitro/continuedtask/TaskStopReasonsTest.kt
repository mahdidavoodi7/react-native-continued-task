package com.margelo.nitro.continuedtask

import androidx.work.WorkInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The stop-reason mapping is the piece most likely to be silently wrong and
 * the hardest to provoke for real: reaching the six-hour `dataSync` budget or
 * exhausting JobScheduler quota is not something a test can arrange. So the
 * mapping is a pure function and it is tested directly.
 */
class TaskStopReasonsTest {

  @Test
  fun `maps the Android 15 foreground service timeout`() {
    assertEquals(
      TaskStopReason.FGS_TIMEOUT,
      TaskStopReasons.fromWorkManagerStopReason(
        WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT
      )
    )
  }

  @Test
  fun `maps the Android 16 quota exhaustion`() {
    assertEquals(
      TaskStopReason.QUOTA,
      TaskStopReasons.fromWorkManagerStopReason(WorkInfo.STOP_REASON_QUOTA)
    )
  }

  @Test
  fun `distinguishes a user cancellation from an app cancellation`() {
    assertEquals(
      TaskStopReason.USER_CANCELLED,
      TaskStopReasons.fromWorkManagerStopReason(WorkInfo.STOP_REASON_USER)
    )
    assertEquals(
      TaskStopReason.APP_CANCELLED,
      TaskStopReasons.fromWorkManagerStopReason(WorkInfo.STOP_REASON_CANCELLED_BY_APP)
    )
  }

  @Test
  fun `treats system and constraint stops as expiration`() {
    val systemStops = listOf(
      WorkInfo.STOP_REASON_TIMEOUT,
      WorkInfo.STOP_REASON_PREEMPT,
      WorkInfo.STOP_REASON_DEVICE_STATE,
      WorkInfo.STOP_REASON_BACKGROUND_RESTRICTION,
      WorkInfo.STOP_REASON_APP_STANDBY,
      WorkInfo.STOP_REASON_CONSTRAINT_CONNECTIVITY,
      WorkInfo.STOP_REASON_CONSTRAINT_CHARGING,
      WorkInfo.STOP_REASON_CONSTRAINT_BATTERY_NOT_LOW,
      WorkInfo.STOP_REASON_CONSTRAINT_DEVICE_IDLE,
      WorkInfo.STOP_REASON_CONSTRAINT_STORAGE_NOT_LOW
    )
    systemStops.forEach { stopReason ->
      assertEquals(
        "stop reason $stopReason",
        TaskStopReason.EXPIRED,
        TaskStopReasons.fromWorkManagerStopReason(stopReason)
      )
    }
  }

  @Test
  fun `falls back to unknown rather than guessing`() {
    assertEquals(
      TaskStopReason.UNKNOWN,
      TaskStopReasons.fromWorkManagerStopReason(WorkInfo.STOP_REASON_UNKNOWN)
    )
    assertEquals(
      TaskStopReason.UNKNOWN,
      TaskStopReasons.fromWorkManagerStopReason(9999)
    )
  }

  @Test
  fun `never reports app-terminated, which only reconciliation can infer`() {
    val everyKnownStopReason = listOf(
      WorkInfo.STOP_REASON_NOT_STOPPED,
      WorkInfo.STOP_REASON_UNKNOWN,
      WorkInfo.STOP_REASON_CANCELLED_BY_APP,
      WorkInfo.STOP_REASON_PREEMPT,
      WorkInfo.STOP_REASON_TIMEOUT,
      WorkInfo.STOP_REASON_DEVICE_STATE,
      WorkInfo.STOP_REASON_QUOTA,
      WorkInfo.STOP_REASON_BACKGROUND_RESTRICTION,
      WorkInfo.STOP_REASON_APP_STANDBY,
      WorkInfo.STOP_REASON_USER,
      WorkInfo.STOP_REASON_SYSTEM_PROCESSING,
      WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT
    )
    everyKnownStopReason.forEach { stopReason ->
      assertNotEquals(
        TaskStopReason.APP_TERMINATED,
        TaskStopReasons.fromWorkManagerStopReason(stopReason)
      )
    }
  }

  @Test
  fun `carries the platform name for every reason it knows`() {
    assertEquals(
      "STOP_REASON_FOREGROUND_SERVICE_TIMEOUT",
      TaskStopReasons.nameFor(WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT)
    )
    assertEquals("STOP_REASON_QUOTA", TaskStopReasons.nameFor(WorkInfo.STOP_REASON_QUOTA))
    assertEquals("STOP_REASON_USER", TaskStopReasons.nameFor(WorkInfo.STOP_REASON_USER))
  }

  @Test
  fun `keeps an unrecognized reason identifiable rather than opaque`() {
    assertEquals("STOP_REASON_9999", TaskStopReasons.nameFor(9999))
  }

  @Test
  fun `guards against hardcoding, since several constants are negative`() {
    assertTrue(WorkInfo.STOP_REASON_FOREGROUND_SERVICE_TIMEOUT < 0)
    assertTrue(WorkInfo.STOP_REASON_UNKNOWN < 0)
    assertEquals(10, WorkInfo.STOP_REASON_QUOTA)
  }
}
