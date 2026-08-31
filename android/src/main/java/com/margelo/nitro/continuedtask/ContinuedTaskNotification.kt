package com.margelo.nitro.continuedtask

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.ForegroundInfo
import androidx.work.WorkManager
import java.util.UUID

/**
 * Builds the ongoing notification that stands in for the iOS Live Activity.
 *
 * Android has no system-provided progress UI for a foreground service, so the
 * notification carries the title, subtitle and progress bar, plus the cancel
 * action that produces `WorkInfo.STOP_REASON_CANCELLED_BY_APP`.
 */
class ContinuedTaskNotification(
  private val context: Context,
  private val options: AndroidTaskOptions?
) {

  private val channelId: String = options?.notificationChannelId ?: DEFAULT_CHANNEL_ID
  private val channelName: String = options?.notificationChannelName ?: DEFAULT_CHANNEL_NAME

  fun foregroundInfo(
    workId: UUID,
    title: String,
    subtitle: String,
    completedUnitCount: Double,
    totalUnitCount: Double
  ): ForegroundInfo {
    val notification = build(workId, title, subtitle, completedUnitCount, totalUnitCount)
    val notificationId = workId.hashCode()

    // The three-argument constructor requires API 29; below that the service
    // type is expressed only by the manifest entry.
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ForegroundInfo(notificationId, notification, serviceTypeFlag())
    } else {
      ForegroundInfo(notificationId, notification)
    }
  }

  private fun build(
    workId: UUID,
    title: String,
    subtitle: String,
    completedUnitCount: Double,
    totalUnitCount: Double
  ): Notification {
    ensureChannel()

    val builder = NotificationCompat.Builder(context, channelId)
      .setContentTitle(title)
      .setContentText(subtitle)
      .setSmallIcon(smallIconResource())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)

    if (totalUnitCount > 0) {
      builder.setProgress(totalUnitCount.toInt(), completedUnitCount.toInt(), false)
    } else {
      builder.setProgress(0, 0, true)
    }

    if (options?.showCancelAction != false) {
      builder.addAction(
        android.R.drawable.ic_menu_close_clear_cancel,
        options?.cancelActionLabel ?: DEFAULT_CANCEL_LABEL,
        WorkManager.getInstance(context).createCancelPendingIntent(workId)
      )
    }

    return builder.build()
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(channelId) != null) return
    manager.createNotificationChannel(
      NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_LOW)
    )
  }

  private fun smallIconResource(): Int {
    val name = options?.notificationIcon
    if (name != null) {
      val resolved = context.resources.getIdentifier(name, "drawable", context.packageName)
      if (resolved != 0) return resolved
    }
    return context.applicationInfo.icon
  }

  private fun serviceTypeFlag(): Int = when (options?.foregroundServiceType) {
    AndroidForegroundServiceType.MEDIAPROCESSING ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROCESSING
      } else {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      }
    AndroidForegroundServiceType.SPECIALUSE ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
      } else {
        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
      }
    else -> ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
  }

  private companion object {
    const val DEFAULT_CHANNEL_ID = "continued-task"
    const val DEFAULT_CHANNEL_NAME = "Background tasks"
    const val DEFAULT_CANCEL_LABEL = "Cancel"
  }
}
