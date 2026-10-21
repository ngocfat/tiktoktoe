import { NativeModules, Platform } from 'react-native';

const { TikTokBackgroundModule } = NativeModules;

export const nativeBackgroundService = {
  isAvailable() {
    return Platform.OS === 'android' && Boolean(TikTokBackgroundModule);
  },

  /**
   * Khởi động Foreground Service để giữ tiến trình Android luôn chạy ngầm
   */
  async startForegroundService(
    title = 'TikTokToe • Tự động giữ chuỗi',
    message = 'Dịch vụ đang chạy ngầm để bảo vệ chuỗi TikTok 24/7...'
  ) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.startForegroundService(title, message);
    } catch (e) {
      console.warn('[NativeBackground] Lỗi startForegroundService:', e);
      return false;
    }
  },

  /**
   * Dừng Foreground Service
   */
  async stopForegroundService() {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.stopForegroundService();
    } catch (e) {
      console.warn('[NativeBackground] Lỗi stopForegroundService:', e);
      return false;
    }
  },

  /**
   * Kiểm tra Foreground Service có đang chạy không
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
   * Đặt chuông báo thức chính xác từng giây qua Android AlarmManager (WAKE_UP)
   */
  async scheduleExactAlarm(id, timestampMs) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.scheduleExactAlarm(String(id), Number(timestampMs));
    } catch (e) {
      console.warn(`[NativeBackground] Lỗi scheduleExactAlarm ${id}:`, e);
      return false;
    }
  },

  /**
   * Hủy chuông báo thức cho task id
   */
  async cancelExactAlarm(id) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.cancelExactAlarm(String(id));
    } catch (e) {
      console.warn(`[NativeBackground] Lỗi cancelExactAlarm ${id}:`, e);
      return false;
    }
  },

  /**
   * Hiển thị thông báo kết quả ra thanh thông báo Android
   */
  async showLocalNotification(title, message) {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.showLocalNotification(title, message);
    } catch (e) {
      console.warn('[NativeBackground] Lỗi showLocalNotification:', e);
      return false;
    }
  },

  /**
   * Kiểm tra app đã được miễn trừ tối ưu hóa pin chưa
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
   * Mở cài đặt hệ thống để người dùng cho phép app chạy ngầm không bị pin hạn chế
   */
  async requestIgnoreBatteryOptimizations() {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.requestIgnoreBatteryOptimizations();
    } catch (e) {
      console.warn('[NativeBackground] Lỗi requestIgnoreBatteryOptimizations:', e);
      return false;
    }
  },

  /**
   * Tải file video/audio về máy bằng Engine Native Stream trực tiếp độc lập
   * Báo cáo tiến trình thời gian thực (0% - 100%) và tự quét vào Bộ sưu tập
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
      throw new Error('Tính năng chỉ khả dụng trên ứng dụng Android!');
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
      console.warn('[NativeBackground] Lỗi downloadMediaWithProgress:', e);
      throw e;
    }
  },

  /**
   * Tải file video/audio về máy
   */
  async downloadMediaFile(url, fileName, title = 'TikTokToe Media', mimeType = 'video/mp4') {
    if (!this.isAvailable()) return false;
    try {
      return await TikTokBackgroundModule.downloadMediaFile(url, fileName, title, mimeType);
    } catch (e) {
      console.warn('[NativeBackground] Lỗi downloadMediaFile:', e);
      throw e;
    }
  },

  /**
   * Đọc nội dung bộ nhớ tạm (Clipboard) từ hệ thống Android
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
   * Ghi nội dung vào bộ nhớ tạm (Clipboard) của hệ thống Android
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
