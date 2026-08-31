import { androidEmulator, androidPlatform } from '@react-native-harness/platform-android';
import { appleSimulator, applePlatform } from '@react-native-harness/platform-apple';

/**
 * React Native Harness runs the tests under `harness/` inside the real example
 * app, on a real device or emulator, against the real HybridObjects.
 *
 * This is the only automated layer that touches native code. Plain Jest cannot
 * reach it: `react-native-nitro-modules` ships no Jest mock and its
 * HybridObjects cannot be instantiated outside a React Native runtime.
 *
 * The iOS simulator has no background task scheduler — `BGTaskScheduler`
 * returns `.unavailable` there — so the iOS runner verifies the shape of the
 * API and that it degrades honestly. The behaviour of a real
 * `BGContinuedProcessingTask` needs a physical iOS 26 device and the manual
 * checklist in the app.
 */
export default {
  entryPoint: './harness/index.js',
  appRegistryComponentName: 'main',
  defaultRunner: 'android',
  testTimeout: 30000,
  // 8081 is often taken by another project's Metro. Pinning the port keeps the
  // `adb reverse tcp:8081 tcp:8083` mapping in `yarn harness:android` correct.
  metroPort: 8083,
  runners: [
    androidPlatform({
      name: 'android',
      device: androidEmulator('Medium_Phone_API_36.0'),
      bundleId: 'continuedtask.example',
      activityName: '.MainActivity',
    }),
    applePlatform({
      name: 'ios',
      device: appleSimulator('iPhone 17 Pro', '26.1'),
      bundleId: 'continuedtask.example',
    }),
  ],
};
