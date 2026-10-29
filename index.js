/**
 * @format
 */
// Must load before anything that mints ids: it provides crypto.getRandomValues.
import 'react-native-get-random-values';
import { AppRegistry } from 'react-native';
import { initObservability } from './src/core/observability';
import { wrapRoot } from './src/core/observability/errorReporting';
import App from './src/app/App';
import { registerBackgroundHandlers } from './src/core/push/backgroundHandlers';
import { name as appName } from './app.json';

// Crash reporting and analytics start before anything else can fail or be measured.
initObservability();

// Notification tap handlers must exist before the app component is registered.
registerBackgroundHandlers();

AppRegistry.registerComponent(appName, () => wrapRoot(App));
