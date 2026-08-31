import { AppRegistry } from 'react-native';
import { ReactNativeHarness } from 'react-native-harness';

// Replaces the example app's own root component when the harness runs, so the
// tests execute inside the same binary — same Nitro autolinking, same
// entitlements, same manifest — that a user would ship.
AppRegistry.registerComponent('main', () => ReactNativeHarness);
