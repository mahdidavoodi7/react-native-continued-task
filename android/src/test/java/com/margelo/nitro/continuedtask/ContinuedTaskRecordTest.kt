package com.margelo.nitro.continuedtask

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The record is what survives process death, so its JS spellings and its
 * notion of "still live" have to stay exact — those two things are what the
 * reconciliation path reads.
 */
class ContinuedTaskRecordTest {

  private fun record(state: ContinuedTaskState) = ContinuedTaskRecord.create(
    id = "com.foo.MyApp.export.abc",
    identifierPrefix = "com.foo.MyApp.export",
    title = "Exporting",
    subtitle = "0 of 10",
    totalUnitCount = 10.0
  ).apply { this.state = ContinuedTaskRecord.stateName(state) }

  @Test
  fun `uses the JS spelling of every state`() {
    assertEquals("pending", ContinuedTaskRecord.stateName(ContinuedTaskState.PENDING))
    assertEquals("running", ContinuedTaskRecord.stateName(ContinuedTaskState.RUNNING))
    assertEquals("finished", ContinuedTaskRecord.stateName(ContinuedTaskState.FINISHED))
    assertEquals("stopped", ContinuedTaskRecord.stateName(ContinuedTaskState.STOPPED))
  }

  @Test
  fun `uses the kebab-case JS spelling of every stop reason`() {
    assertEquals("fgs-timeout", ContinuedTaskRecord.stopReasonName(TaskStopReason.FGS_TIMEOUT))
    assertEquals(
      "user-cancelled",
      ContinuedTaskRecord.stopReasonName(TaskStopReason.USER_CANCELLED)
    )
    assertEquals(
      "app-terminated",
      ContinuedTaskRecord.stopReasonName(TaskStopReason.APP_TERMINATED)
    )
    assertEquals("quota", ContinuedTaskRecord.stopReasonName(TaskStopReason.QUOTA))
  }

  @Test
  fun `counts pending and running as live, so they can be reconciled`() {
    assertTrue(record(ContinuedTaskState.PENDING).isLive)
    assertTrue(record(ContinuedTaskState.RUNNING).isLive)
    assertFalse(record(ContinuedTaskState.FINISHED).isLive)
    assertFalse(record(ContinuedTaskState.STOPPED).isLive)
  }

  @Test
  fun `round-trips through JSON without losing a field`() {
    val original = record(ContinuedTaskState.RUNNING).apply {
      completedUnitCount = 4.0
      stopReason = ContinuedTaskRecord.stopReasonName(TaskStopReason.QUOTA)
    }
    val restored = ContinuedTaskRecord.fromJson(original.toJson())

    assertEquals(original.id, restored.id)
    assertEquals(original.identifierPrefix, restored.identifierPrefix)
    assertEquals(original.title, restored.title)
    assertEquals(original.subtitle, restored.subtitle)
    assertEquals(original.submittedAt, restored.submittedAt, 0.0)
    assertEquals(original.state, restored.state)
    assertEquals(original.completedUnitCount, restored.completedUnitCount, 0.0)
    assertEquals(original.totalUnitCount, restored.totalUnitCount, 0.0)
    assertEquals(original.stopReason, restored.stopReason)
  }

  @Test
  fun `round-trips an absent stop reason as null, not the string null`() {
    val restored = ContinuedTaskRecord.fromJson(record(ContinuedTaskState.PENDING).toJson())
    assertEquals(null, restored.stopReason)
  }

  @Test
  fun `converts to the KnownTask shape JS receives`() {
    val known = record(ContinuedTaskState.RUNNING).apply {
      stopReason = ContinuedTaskRecord.stopReasonName(TaskStopReason.APP_TERMINATED)
    }.toKnownTask()

    assertEquals("com.foo.MyApp.export.abc", known.id)
    assertEquals("com.foo.MyApp.export", known.identifierPrefix)
    assertEquals(ContinuedTaskState.RUNNING, known.state)
    assertEquals(TaskStopReason.APP_TERMINATED, known.stopReason)
    assertEquals(10.0, known.totalUnitCount, 0.0)
  }
}
