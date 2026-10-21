import { NativeModules, Platform } from 'react-native';

const { TikTokBackgroundModule } = NativeModules;

export const nativeBackgroundService = {
  isAvailable() {
    return Platform.OS === 'android' && Boolean(TikTokBackgroundModule);
  },

  /**
   * Starts Foreground Service to keep Android process alive in background
   */
  async startForegroundService(
    title = 'TikTokToe: Automated Streak Keeper',
    message = 'Background service is running to maintain 24/7 streak automation...'
  ) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.startForegroundService(title, message);
    } catch (e) {
      console.warn('[NativeBackground] startForegroundService error:', e);
      return false;
    }
  },

  /**
   * Stops Foreground Service
   */
  async stopForegroundService() {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.stopForegroundService();
    } catch (e) {
      console.warn('[NativeBackground] stopForegroundService error:', e);
      return false;
    }
  },

  /**
   * Checks whether Foreground Service is currently running
   */
  async isForegroundServiceRunning() {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.isForegroundServiceRunning();
    } catch (e) {
      return false;
    }
  },

  /**
   * Schedules exact second-accurate alarm via Android AlarmManager (WAKE_UP)
   */
  async scheduleExactAlarm(id, timestampMs) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.scheduleExactAlarm(String(id), Number(timestampMs));
    } catch (e) {
      console.warn(`[NativeBackground] scheduleExactAlarm error for ${id}:`, e);
      return false;
    }
  },

  /**
   * Cancels exact alarm for given task ID
   */
  async cancelExactAlarm(id) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.cancelExactAlarm(String(id));
    } catch (e) {
      console.warn(`[NativeBackground] cancelExactAlarm error for ${id}:`, e);
      return false;
    }
  },

  /**
   * Displays local notification on Android status bar
   */
  async showLocalNotification(title, message) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.showLocalNotification(title, message);
    } catch (e) {
      console.warn('[NativeBackground] showLocalNotification error:', e);
      return false;
    }
  },

  /**
   * Checks if app is exempt from battery optimization
   */
  async isIgnoringBatteryOptimizations() {
    if (!this.isAvailable()) return true;
    try {
      return await TikTokBackgroundModule.isIgnoringBatteryOptimizations();
    } catch (e) {
      return false;
    }
  },

  /**
   * Opens system settings requesting battery optimization exemption
   */
  async requestIgnoreBatteryOptimizations() {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.requestIgnoreBatteryOptimizations();
    } catch (e) {
      console.warn('[NativeBackground] requestIgnoreBatteryOptimizations error:', e);
      return false;
    }
  },

  /**
   * Downloads media file using native streaming engine with progress tracking
   * Scans output into Android MediaStore/Gallery upon completion
   */
  async downloadMediaWithProgress(
    mediaUrl,
    pageUrl = null,
    fileName = 'TikTokToe_Media.mp4',
    title = 'TikTokToe Media',
    mimeType = 'video/mp4',
    customCookie = ''
  ) {
    if (!this.isAvailable()) {
      throw new Error('Feature available only on Android platform');
    }
    try {
      return await TikTokBackgroundModule.downloadMediaWithProgress(
        mediaUrl,
        pageUrl,
        fileName,
        title,
        mimeType,
        customCookie
      );
    } catch (e) {
      console.warn('[NativeBackground] downloadMediaWithProgress error:', e);
      throw e;
    }
  },

  /**
   * Downloads media file to device
   */
  async downloadMediaFile(url, fileName, title = 'TikTokToe Media', mimeType = 'video/mp4') {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.downloadMediaFile(url, fileName, title, mimeType);
    } catch (e) {
      console.warn('[NativeBackground] downloadMediaFile error:', e);
      throw e;
    }
  },

  /**
   * Reads clipboard text from Android system
   */
  async getClipboardText() {
    if (!this.isAvailable()) return '';
    try {
      return await TikTokBackgroundModule.getClipboardText();
    } catch (e) {
      return '';
    }
  },

  /**
   * Copies text to Android system clipboard
   */
  async setClipboardText(text) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.setClipboardText(String(text));
    } catch (e) {
      return false;
    }
  },
};
