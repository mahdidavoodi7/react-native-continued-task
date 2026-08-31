import BackgroundTasks
import Foundation

/// An error thrown out of `submit` and carried to JS as
/// `"continued-task/<code>: <message>"`.
///
/// Nitro stringifies a thrown Swift `Error` with `String(describing:)`, so the
/// `CustomStringConvertible` conformance below is what the JS
/// `getSubmitErrorCode` helper parses. The four `BGTaskScheduler.Error.Code`
/// cases are kept distinct because they call for different fixes.
struct SubmitError: Error, CustomStringConvertible {
  let code: String
  let message: String

  var description: String {
    return "continued-task/\(code): \(message)"
  }

  static func notPermitted(_ message: String) -> SubmitError {
    return SubmitError(code: "not-permitted", message: message)
  }

  static func invalidIdentifier(_ message: String) -> SubmitError {
    return SubmitError(code: "invalid-identifier", message: message)
  }

  static func invalidOptions(_ message: String) -> SubmitError {
    return SubmitError(code: "invalid-options", message: message)
  }

  static func unsupportedPlatform(_ message: String) -> SubmitError {
    return SubmitError(code: "unsupported-platform", message: message)
  }

  static func unknown(_ message: String) -> SubmitError {
    return SubmitError(code: "unknown", message: message)
  }

  /// Maps an error returned by `BGTaskScheduler.submit(_:)` onto a stable code.
  ///
  /// The raw domain and code are kept in the message so a report from a real
  /// device stays debuggable even when the mapping falls through to `unknown`.
  static func from(schedulerError error: Error) -> SubmitError {
    let nsError = error as NSError
    let detail = "\(nsError.domain) \(nsError.code): \(nsError.localizedDescription)"

    guard nsError.domain == BGTaskScheduler.errorDomain else {
      return SubmitError(code: "unknown", message: detail)
    }

    switch BGTaskScheduler.Error.Code(rawValue: nsError.code) {
    case .unavailable:
      return SubmitError(
        code: "unavailable",
        message:
          "Background task scheduling is unavailable. Background App Refresh may be off in Settings, or this is the Simulator, which has no background task scheduler. (\(detail))"
      )
    case .tooManyPendingTaskRequests:
      return SubmitError(
        code: "too-many-pending-requests",
        message: "Too many pending task requests. Cancel some and retry. (\(detail))"
      )
    case .notPermitted:
      return SubmitError(
        code: "not-permitted",
        message:
          "Not permitted. The identifier may be missing from BGTaskSchedulerPermittedIdentifiers, the requested GPU resource may be unentitled or unavailable, or the user denied background launches. (\(detail))"
      )
    case .immediateRunIneligible:
      return SubmitError(
        code: "immediate-run-ineligible",
        message:
          "The system could not start this task immediately, and it was submitted with the 'fail' submission strategy. (\(detail))"
      )
    default:
      return SubmitError(code: "unknown", message: detail)
    }
  }
}
