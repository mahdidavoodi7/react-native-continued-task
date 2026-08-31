import BackgroundTasks
import Foundation

extension ContinuedTaskOptions {
  /// Builds the `BGContinuedProcessingTaskRequest` for a concrete identifier.
  ///
  /// `strategy` is always set explicitly. The enum is declared `Fail = 0`,
  /// `Queue = 1`, but the property documents its default as `Queue` — the raw
  /// zero value is not the default, so leaving it alone would be a bug.
  ///
  /// `requiredResources` is left as the empty option set unless the GPU was
  /// requested. `BGContinuedProcessingTaskRequestResourcesDefault` is `0` and
  /// carries no `NS_SWIFT_NAME`, and Swift's importer drops zero-valued
  /// `NS_OPTIONS` members, so `[]` is the only spelling of the default.
  @available(iOS 26.0, *)
  func toTaskRequest(identifier: String) throws -> BGContinuedProcessingTaskRequest {
    let request = BGContinuedProcessingTaskRequest(
      identifier: identifier,
      title: title,
      subtitle: subtitle
    )

    switch ios?.submissionStrategy {
    case .fail:
      request.strategy = .fail
    case .queue, .none:
      request.strategy = .queue
    }

    if ios?.requiresGPU == true {
      guard BGTaskScheduler.supportedResources.contains(.gpu) else {
        throw SubmitError.notPermitted(
          "requiresGPU was set but this device does not report GPU support in BGTaskScheduler.supportedResources. Check ContinuedTasks.supportsGPU first."
        )
      }
      request.requiredResources = .gpu
    }

    return request
  }
}
