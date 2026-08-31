import Foundation

extension Bundle {
  /// The raw `BGTaskSchedulerPermittedIdentifiers` array from `Info.plist`.
  var continuedTaskPermittedIdentifiers: [String] {
    return object(forInfoDictionaryKey: "BGTaskSchedulerPermittedIdentifiers") as? [String] ?? []
  }

  /// Validates an `identifierPrefix` against the rules the scheduler enforces,
  /// before a bad value can reach `BGTaskScheduler` and come back as an opaque
  /// `.notPermitted`.
  ///
  /// The prefix is written without its trailing `.*`. It has to start with the
  /// bundle identifier, and its wildcard expansion has to appear in
  /// `BGTaskSchedulerPermittedIdentifiers`.
  func validateContinuedTaskPrefix(_ prefix: String) throws {
    guard !prefix.isEmpty else {
      throw SubmitError.invalidIdentifier("identifierPrefix must not be empty.")
    }
    guard !prefix.hasSuffix(".*") else {
      throw SubmitError.invalidIdentifier(
        "identifierPrefix must be written without its trailing '.*' — pass '\(prefix.dropLast(2))'."
      )
    }
    guard let bundleIdentifier = bundleIdentifier else {
      throw SubmitError.invalidIdentifier("The app has no bundle identifier.")
    }
    guard prefix.hasPrefix(bundleIdentifier) else {
      throw SubmitError.invalidIdentifier(
        "identifierPrefix '\(prefix)' must start with the app's bundle identifier '\(bundleIdentifier)'."
      )
    }

    let permitted = continuedTaskPermittedIdentifiers
    guard permitted.contains("\(prefix).*") || permitted.contains(prefix) else {
      throw SubmitError.notPermitted(
        "'\(prefix).*' is not in BGTaskSchedulerPermittedIdentifiers. Add it via the Expo config plugin's identifierPrefixes option, or to Info.plist directly. Found: \(permitted)."
      )
    }
  }
}
