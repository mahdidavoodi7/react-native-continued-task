import BackgroundTasks
import Foundation

/// The single place this library hands a request to `BGTaskScheduler`.
///
/// `BGTaskScheduler.submit(_:)` is reported as deprecated in iOS 27 in favour
/// of `submitTaskRequest(_:completionHandler:)`. That replacement does **not**
/// exist in the iOS 26.5 SDK shipped with Xcode 26.5: `BGTaskScheduler`
/// declares only `submitTaskRequest:error:`, which `BackgroundTasks.apinotes`
/// maps to Swift `submit(_:)`, and it carries no deprecation attribute. There
/// is no symbol to call inside an `if #available(iOS 27, *)` branch and no
/// availability macro to guard on, so the newer path cannot be compiled today.
///
/// Every submission funnels through here so that adding it later is a change
/// to this one function rather than a hunt through the implementation.
enum ContinuedTaskSubmitter {
  @available(iOS 26.0, *)
  static func submit(_ request: BGContinuedProcessingTaskRequest) throws {
    do {
      try BGTaskScheduler.shared.submit(request)
    } catch {
      throw SubmitError.from(schedulerError: error)
    }
  }
}
