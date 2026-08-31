package com.margelo.nitro.continuedtask

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * Exercises the reconciliation path against real SharedPreferences.
 *
 * This is the behaviour that makes work interrupted by process death visible
 * to the app at all, and it is pure storage logic — no worker, no foreground
 * service — so an instrumented test can cover it fully.
 */
@RunWith(AndroidJUnit4::class)
class ContinuedTaskStoreTest {

  private lateinit var store: ContinuedTaskStore

  @Before
  fun setUp() {
    val context = ApplicationProvider.getApplicationContext<android.content.Context>()
    context
      .getSharedPreferences("com.margelo.continuedtask", android.content.Context.MODE_PRIVATE)
      .edit()
      .clear()
      .commit()
    store = ContinuedTaskStore(context)
  }

  private fun record(id: String, state: ContinuedTaskState) =
    ContinuedTaskRecord.create(
      id = id,
      identifierPrefix = "com.foo.MyApp.export",
      title = "Exporting",
      subtitle = "0 of 10",
      totalUnitCount = 10.0
    ).apply { this.state = ContinuedTaskRecord.stateName(state) }

  @Test
  fun persistsAndReadsBackARecord() {
    store.insert(record("a", ContinuedTaskState.PENDING))
    val found = store.find("a")

    assertEquals("a", found?.id)
    assertEquals("Exporting", found?.title)
    assertEquals(10.0, found?.totalUnitCount ?: 0.0, 0.0)
  }

  @Test
  fun survivesANewStoreInstance() {
    store.insert(record("a", ContinuedTaskState.RUNNING))
    val reopened =
      ContinuedTaskStore(ApplicationProvider.getApplicationContext())

    assertEquals("a", reopened.find("a")?.id)
  }

  @Test
  fun marksLiveRecordsFromAPreviousLaunchAsAppTerminated() {
    store.insert(record("running", ContinuedTaskState.RUNNING))
    store.insert(record("pending", ContinuedTaskState.PENDING))

    store.reconcileRecordsFromPreviousLaunch(stillRunningIds = emptySet())

    listOf("running", "pending").forEach { id ->
      val reconciled = store.find(id)
      assertEquals(
        ContinuedTaskRecord.stateName(ContinuedTaskState.STOPPED),
        reconciled?.state
      )
      assertEquals(
        ContinuedTaskRecord.stopReasonName(TaskStopReason.APP_TERMINATED),
        reconciled?.stopReason
      )
    }
  }

  @Test
  fun leavesWorkManagerStillRunningAlone() {
    store.insert(record("alive", ContinuedTaskState.RUNNING))

    store.reconcileRecordsFromPreviousLaunch(stillRunningIds = setOf("alive"))

    assertEquals(
      ContinuedTaskRecord.stateName(ContinuedTaskState.RUNNING),
      store.find("alive")?.state
    )
    assertNull(store.find("alive")?.stopReason)
  }

  @Test
  fun leavesAlreadyFinishedRecordsAlone() {
    store.insert(record("done", ContinuedTaskState.FINISHED))

    store.reconcileRecordsFromPreviousLaunch(stillRunningIds = emptySet())

    assertEquals(
      ContinuedTaskRecord.stateName(ContinuedTaskState.FINISHED),
      store.find("done")?.state
    )
    assertNull(store.find("done")?.stopReason)
  }

  @Test
  fun updatesProgressInPlace() {
    store.insert(record("a", ContinuedTaskState.RUNNING))

    store.update("a") { it.completedUnitCount = 7.0 }

    assertEquals(7.0, store.find("a")?.completedUnitCount ?: 0.0, 0.0)
  }

  @Test
  fun ignoresAnUpdateForAnUnknownId() {
    store.update("missing") { it.completedUnitCount = 7.0 }
    assertNull(store.find("missing"))
  }

  @Test
  fun returnsRecordsNewestFirst() {
    store.insert(record("old", ContinuedTaskState.FINISHED).apply { })
    Thread.sleep(5)
    store.insert(record("new", ContinuedTaskState.FINISHED))

    assertEquals("new", store.allRecords().first().id)
  }

  @Test
  fun forgetsOnlyTheIdsGiven() {
    store.insert(record("a", ContinuedTaskState.FINISHED))
    store.insert(record("b", ContinuedTaskState.FINISHED))

    store.forget(listOf("a", "unknown"))

    assertNull(store.find("a"))
    assertEquals("b", store.find("b")?.id)
  }

  @Test
  fun keepsRecordsUntilTheAppForgetsThem() {
    store.insert(record("a", ContinuedTaskState.RUNNING))
    store.reconcileRecordsFromPreviousLaunch(emptySet())

    assertTrue(store.allRecords().isNotEmpty())
  }
}
