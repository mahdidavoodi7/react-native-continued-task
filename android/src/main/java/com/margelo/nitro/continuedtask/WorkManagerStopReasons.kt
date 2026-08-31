package com.margelo.nitro.continuedtask

/**
 * Names for stops the library reports without a WorkManager stop reason to
 * read, such as cancelling work that never started.
 */
internal object WorkManagerStopReasons {
  const val CANCELLED_BY_APP_NAME = "STOP_REASON_CANCELLED_BY_APP"
}
