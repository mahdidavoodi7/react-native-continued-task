package com.margelo.nitro.continuedtask

/**
 * An exception thrown out of `submit`, carried to JS as
 * `"continued-task/<code>: <message>"` so the `getSubmitErrorCode` helper can
 * read a stable code off it.
 */
class SubmitException(val code: String, message: String) :
  Exception("continued-task/$code: $message") {

  companion object {
    fun invalidIdentifier(message: String) = SubmitException("invalid-identifier", message)

    fun invalidOptions(message: String) = SubmitException("invalid-options", message)

    fun foregroundServiceUnavailable(message: String) =
      SubmitException("foreground-service-unavailable", message)

    fun unknown(message: String) = SubmitException("unknown", message)
  }
}
