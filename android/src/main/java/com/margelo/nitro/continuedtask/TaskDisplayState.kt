package com.margelo.nitro.continuedtask

/**
 * The part of a task's state the ongoing notification renders.
 *
 * Kept separate from [HybridContinuedTask] so the worker can observe one flow
 * rather than polling several properties.
 */
internal data class TaskDisplayState(
  val title: String,
  val subtitle: String,
  val completedUnitCount: Double,
  val totalUnitCount: Double
)
