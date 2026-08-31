import { AppRegistry } from 'react-native';
import { registerRootComponent } from 'expo';
// Importing the runtime is what installs `describe`/`it`/`expect` as globals.
// It is imported unconditionally so the harness bundle cannot depend on the
// flag below having been inlined correctly.
import { ReactNativeHarness } from 'react-native-harness';

import App from './src/App';

// The Expo native project bakes its JS entry to Metro's virtual entry, so
// Harness's own `entryPoint` never reaches the app. `EXPO_PUBLIC_*` variables
// are inlined by babel-preset-expo at bundle time, which lets the same binary
// boot either the QA app or the Harness runner depending on how Metro was
// started. `yarn harness:android` sets it.
if (process.env.EXPO_PUBLIC_RN_HARNESS === '1') {
  AppRegistry.registerComponent('main', () => ReactNativeHarness);
} else {
  registerRootComponent(App);
}
