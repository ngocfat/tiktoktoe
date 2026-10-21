import AsyncStorage from '@react-native-async-storage/async-storage';

const DEV_MODE_STORAGE_KEY = '@tiktoktoe_dev_mode_v1';
const MAX_LOGS = 150;

class DebugLoggerService {
  constructor() {
    this.isDevMode = false;
    this.logs = [];
    this.listeners = new Set();
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(DEV_MODE_STORAGE_KEY);
      this.isDevMode = stored === 'true';
    } catch (_) {
      this.isDevMode = false;
    }
    this.initialized = true;
  }

  isDevModeEnabled() {
    return this.isDevMode;
  }

  async setDevMode(enabled) {
    this.isDevMode = Boolean(enabled);
    try {
      await AsyncStorage.setItem(DEV_MODE_STORAGE_KEY, String(this.isDevMode));
    } catch (_) {}
    this.notify();
    this.addLog(
      'SYSTEM',
      this.isDevMode ? 'info' : 'warn',
      this.isDevMode ? 'Da bat Che do Nha phat trien (Dev Mode)' : 'Da tat Che do Nha phat trien'
    );
  }

  /**
   * Ghi log gỡ lỗi
   * @param {string} module 'VIDEO_EXTRACT' | 'VIDEO_DOWNLOAD' | 'NETWORK' | 'TIKTOK_API' | 'SYSTEM'
   * @param {'info' | 'success' | 'warn' | 'error'} level
   * @param {string} message
   * @param {any} details
   */
  addLog(module, level = 'info', message, details = null) {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(
      now.getMilliseconds()
    ).padStart(3, '0')}`;

    const logEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: timeStr,
      module: module.toUpperCase(),
      level: level.toLowerCase(),
      message: String(message),
      details: details ? (typeof details === 'object' ? JSON.stringify(details, null, 2) : String(details)) : null,
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop();
    }

    // In ra console log native để tiện theo dõi qua ADB / Terminal
    const tag = `[${logEntry.timestamp}][${logEntry.module}][${logEntry.level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(tag, message, details || '');
    } else if (level === 'warn') {
      console.warn(tag, message, details || '');
    } else {
      console.log(tag, message, details || '');
    }

    this.notify();
  }

  getLogs() {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.notify();
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }
    return () => {};
  }

  notify() {
    if (this._notifyTimer) return;
    this._notifyTimer = setTimeout(() => {
      this._notifyTimer = null;
      const logsCopy = [...this.logs];
      this.listeners.forEach((listener) => {
        try {
          listener(this.isDevMode, logsCopy);
        } catch (_) {}
      });
    }, 40);
  }
}

export const debugLogger = new DebugLoggerService();
// Khởi tạo ngay trạng thái từ AsyncStorage
debugLogger.init();
