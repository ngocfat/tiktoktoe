import { registerRootComponent } from 'expo';
import { AppRegistry } from 'react-native';
import App from './App';
import { handleHeadlessStreakTask } from './src/services/headlessStreakTask';

// Đăng ký ứng dụng chính
registerRootComponent(App);

// Đăng ký tác vụ chạy ngầm Headless JS cho Android khi app đã đóng
AppRegistry.registerHeadlessTask('TikTokStreakHeadlessTask', () => handleHeadlessStreakTask);

