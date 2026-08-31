import { registerRootComponent } from 'expo';

import App from './src/App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
//
// The React Native Harness entry lives in ../harness/index.js and is not
// imported here: pulling its runtime into the app bundle breaks Hermes with
// "Property 'EventTarget' doesn't exist". Wiring Harness up means getting the
// dev-launcher to load its manifest URL, not importing it from the app entry.
registerRootComponent(App);
