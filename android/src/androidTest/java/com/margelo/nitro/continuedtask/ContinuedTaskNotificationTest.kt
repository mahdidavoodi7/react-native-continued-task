package com.margelo.nitro.continuedtask

import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

/**
 * The Android notification is the counterpart of the iOS Live Activity: it is
 * the only progress UI the user sees, and its cancel action is the only way
 * they can stop the work. Building it for real catches a missing channel or a
 * bad service type flag, which would otherwise surface as a crash on start.
 */
@RunWith(AndroidJUnit4::class)
class ContinuedTaskNotificationTest {

  private val context: Context get() = ApplicationProvider.getApplicationContext()

  private fun options(
    channelId: String? = null,
    showCancelAction: Boolean? = null,
    serviceType: AndroidForegroundServiceType? = null
  ) = AndroidTaskOptions(
    notificationChannelId = channelId,
    notificationChannelName = "Example tasks",
    notificationIcon = null,
    showCancelAction = showCancelAction,
    cancelActionLabel = null,
    foregroundServiceType = serviceType
  )

  @Test
  fun buildsForegroundInfoWithANotification() {
    val info = ContinuedTaskNotification(context, options())
      .foregroundInfo(UUID.randomUUID(), "Exporting", "3 of 10", 3.0, 10.0)

    assertNotNull(info.notification)
    assertNotEquals(0, info.notificationId)
  }

  @Test
  fun createsTheNotificationChannelItPostsOn() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val channelId = "test-channel-${UUID.randomUUID()}"

    ContinuedTaskNotification(context, options(channelId = channelId))
      .foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 10.0)

    val manager = context.getSystemService(NotificationManager::class.java)
    assertNotNull(manager.getNotificationChannel(channelId))
  }

  @Test
  fun defaultsToTheLibraryChannelWhenNoneIsGiven() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

    ContinuedTaskNotification(context, null)
      .foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 10.0)

    val manager = context.getSystemService(NotificationManager::class.java)
    assertNotNull(manager.getNotificationChannel("continued-task"))
  }

  @Test
  fun addsACancelActionByDefault() {
    val info = ContinuedTaskNotification(context, options())
      .foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 10.0)

    assertEquals(1, info.notification.actions?.size ?: 0)
  }

  @Test
  fun omitsTheCancelActionWhenTurnedOff() {
    val info = ContinuedTaskNotification(context, options(showCancelAction = false))
      .foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 10.0)

    assertEquals(0, info.notification.actions?.size ?: 0)
  }

  @Test
  fun declaresTheDataSyncServiceTypeByDefault() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
    val info = ContinuedTaskNotification(context, options())
      .foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 10.0)

    assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC, info.foregroundServiceType)
  }

  @Test
  fun fallsBackToDataSyncForATypeTheOsIsTooOldFor() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
    val info = ContinuedTaskNotification(
      context,
      options(serviceType = AndroidForegroundServiceType.MEDIAPROCESSING)
    ).foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 10.0)

    val expected = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
    } else {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
    }
    assertEquals(expected, info.foregroundServiceType)
  }

  @Test
  fun rendersIndeterminateProgressForAnUnknownTotal() {
    val info = ContinuedTaskNotification(context, options())
      .foregroundInfo(UUID.randomUUID(), "Exporting", "", 0.0, 0.0)

    assertTrue(info.notification.extras.getBoolean("android.progressIndeterminate"))
  }

  @Test
  fun rendersDeterminateProgressForAKnownTotal() {
    val info = ContinuedTaskNotification(context, options())
      .foregroundInfo(UUID.randomUUID(), "Exporting", "3 of 10", 3.0, 10.0)

    val extras = info.notification.extras
    assertEquals(10, extras.getInt("android.progressMax"))
    assertEquals(3, extras.getInt("android.progress"))
  }
}
