/**
 * The handle returned by every `addOn...Listener` method.
 *
 * Removing a subscription stops future emissions. It does not un-deliver an
 * event that the native side has already dispatched to the JS thread.
 */
export interface ListenerSubscription {
  /** Stops this listener from receiving further events. */
  remove: () => void;
}
