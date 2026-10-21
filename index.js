import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';
import { handleHeadlessStreakTask } from './src/services/headlessStreakTask';

// Register the main application root component
registerRootComponent(App);

// Register Android Headless JS task for background execution when the app is closed
AppRegistry.registerHeadlessTask('TikTokStreakHeadlessTask', () => handleHeadlessStreakTask);

