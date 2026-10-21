/**
 * Background Scheduler Worker cho ứng dụng TikTok
 * Kết hợp 3 tầng chạy ngầm:
 * 1. Android Foreground Service: Giữ tiến trình app không bị Android tắt khi vuốt đóng app
 * 2. Android AlarmManager (Exact Alarm + Headless JS): Đánh thức thiết bị chính xác từng giây để gửi
 * 3. In-App Timer: Đếm ngược thời gian thực trên giao diện khi người dùng đang mở app
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendTiktokMessage } from './tiktokApi.js';
import { generateStreakMessageWithGemini } from './geminiService.js';
import { nativeBackgroundService } from './nativeBackgroundService.js';

const STORAGE_KEY = 'TIKTOK_SCHEDULE_TASKS_V1';
const BG_PREF_KEY = 'TIKTOK_BACKGROUND_SERVICE_ENABLED_V1';

class ScheduleWorkerManager {
  constructor() {
    this.tasks = [];
    this.listeners = new Set();
    this.intervalId = null;
    this.isLoaded = false;
    this.isBgServiceEnabled = true;
    this.runningTaskIds = new Set();
    this.runningConvIds = new Set();
    this.isTicking = false;

    // Tự động nạp dữ liệu từ AsyncStorage khi khởi tạo
    this.init();
  }

  async init() {
    await this.loadTasks();
    await this.loadBgPreference();
    this.startWorker();

    // Đồng bộ tất cả các task pending vào Android AlarmManager
    this.syncAllAlarmsToNative();

    // Tự động kích hoạt Foreground Service nếu có task giữ chuỗi đang chờ
    if (this.isBgServiceEnabled && this.hasPendingTasks()) {
      nativeBackgroundService.startForegroundService();
    }
  }

  /**
   * Kiểm tra xem có task nào đang chờ chạy không
   */
  hasPendingTasks() {
    return this.tasks.some((t) => t.status === 'PENDING');
  }

  /**
   * Nạp tùy chọn chạy ngầm đã lưu
   */
  async loadBgPreference() {
    try {
      const val = await AsyncStorage.getItem(BG_PREF_KEY);
      if (val !== null) {
        this.isBgServiceEnabled = val === 'true';
      } else {
        this.isBgServiceEnabled = true; // Mặc định BẬT để đảm bảo giữ chuỗi không bị đứt
      }
    } catch (_) {}
  }

  /**
   * Bật / Tắt dịch vụ Foreground Service chạy ngầm
   */
  async setBackgroundServiceEnabled(enabled) {
    this.isBgServiceEnabled = enabled;
    try {
      await AsyncStorage.setItem(BG_PREF_KEY, String(enabled));
    } catch (_) {}

    if (enabled) {
      await nativeBackgroundService.startForegroundService();
      this.syncAllAlarmsToNative();
    } else {
      await nativeBackgroundService.stopForegroundService();
    }
    this.notify();
    return enabled;
  }

  /**
   * Nạp danh sách tác vụ từ bộ nhớ bền vững (AsyncStorage)
   */
  async loadTasks() {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          const seenPendingConvs = new Set();
          this.tasks = parsed.map((t) => {
            if (t.status === 'SENDING') {
              t.status = 'PENDING';
            }
            if (t.status === 'PENDING') {
              if (seenPendingConvs.has(t.conversationId)) {
                t.status = 'CANCELLED';
                t.resultMsg = 'Hủy bỏ (dọn dẹp lịch trùng lặp)';
              } else {
                seenPendingConvs.add(t.conversationId);
              }
            }
            return t;
          });
          this.notify();
        }
      }
    } catch (e) {
      console.warn('[ScheduleWorker] Lỗi nạp tasks từ AsyncStorage:', e);
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Lưu danh sách tác vụ vào bộ nhớ bền vững
   */
  async saveTasks() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch (e) {
      console.warn('[ScheduleWorker] Lỗi lưu tasks vào AsyncStorage:', e);
    }
  }

  /**
   * Cập nhật cookie mới cho tất cả các task đang chờ chạy
   */
  updateAllPendingCookies(newCookieStr) {
    if (!newCookieStr) return;
    let changed = false;
    for (const task of this.tasks) {
      if (task.status === 'PENDING') {
        task.cookieStr = newCookieStr;
        changed = true;
      }
    }
    if (changed) {
      this.saveTasks();
    }
  }

  /**
   * Đồng bộ toàn bộ các task PENDING sang Android AlarmManager
   */
  syncAllAlarmsToNative() {
    const now = Date.now();
    for (const task of this.tasks) {
      if (task.status === 'PENDING' && task.scheduledTime > now) {
        nativeBackgroundService.scheduleExactAlarm(task.id, task.scheduledTime);
      }
    }
  }

  /**
   * Khởi chạy Worker kiểm tra khi app đang mở (mỗi 2000ms)
   */
  startWorker() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      this.tick();
    }, 2000);
  }

  stopWorker() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Vòng lặp kiểm tra thời gian thực
   * Chỉ kích hoạt notify() khi có tác vụ thực sự được thực thi
   */
  async tick() {
    if (this.isTicking) return;
    this.isTicking = true;

    try {
      const now = Date.now();
      let hasExecuted = false;

      for (const task of this.tasks) {
        if (task.status === 'PENDING' && now >= task.scheduledTime) {
          await this.executeTask(task);
          hasExecuted = true;
        }
      }

      // Chỉ thông báo re-render giao diện nếu có tác vụ vừa hoàn tất
      if (hasExecuted) {
        this.notify();
      }
    } finally {
      this.isTicking = false;
    }
  }

  /**
   * Kiểm tra và thực thi ngay lập tức tất cả các tác vụ đã đến hạn
   * Được gọi khi app khởi động hoặc khi quay lại foreground
   */
  async checkAndExecutePendingTasks(freshCookieStr = null) {
    if (freshCookieStr) {
      this.updateAllPendingCookies(freshCookieStr);
    }
    await this.loadTasks();

    const now = Date.now();
    for (const task of this.tasks) {
      if (task.status === 'PENDING' && now >= task.scheduledTime) {
        await this.executeTask(task);
      }
    }
    this.syncAllAlarmsToNative();
  }

  /**
   * Thực hiện gửi tin nhắn khi đến giờ hẹn
   */
  async executeTask(task) {
    if (task.status !== 'PENDING') return;

    // 0. Khóa đồng bộ trong bộ nhớ ngay lập tức (Single Thread Protection)
    if (this.runningTaskIds.has(task.id) || this.runningConvIds.has(task.conversationId)) {
      console.log(`[ScheduleWorker] Tác vụ ${task.id} hoặc cuộc trò chuyện ${task.conversationId} đang được gửi. Bỏ qua.`);
      return;
    }
    this.runningTaskIds.add(task.id);
    this.runningConvIds.add(task.conversationId);

    try {
      const now = Date.now();
      const taskLockKey = `TASK_EXEC_LOCK_${task.id}`;
      const convLockKey = `CONV_LAST_SENT_${task.conversationId}`;

      // 1. Kiểm tra khoá để đảm bảo không tiến trình nào khác (ví dụ HeadlessJS) chạy đồng thời
      const [taskLocked, convLocked] = await Promise.all([
        AsyncStorage.getItem(taskLockKey),
        AsyncStorage.getItem(convLockKey),
      ]);

      if (taskLocked && (now - parseInt(taskLocked, 10)) < 300000) {
        console.log(`[ScheduleWorker] Task ${task.id} đã bị khóa bởi tiến trình khác. Bỏ qua.`);
        return;
      }

      if (convLocked && (now - parseInt(convLocked, 10)) < 300000) {
        console.log(`[ScheduleWorker] Cuộc trò chuyện ${task.conversationId} vừa được gửi tin trong 5 phút qua. Bỏ qua để chống trùng.`);
        task.status = 'CANCELLED';
        task.resultMsg = 'Bỏ qua (đã gửi trước đó)';
        this.saveTasks();
        return;
      }

      // Đánh dấu khoá ngay lập tức để chặn mọi luồng khác
      await Promise.all([
        AsyncStorage.setItem(taskLockKey, String(now)),
        AsyncStorage.setItem(convLockKey, String(now)),
      ]);

      task.status = 'SENDING';
      task.executedAt = now;
      this.saveTasks();
      this.notify();

      let contentToSend = task.messageText;
      if (task.useAiDaily) {
        try {
          const aiRes = await generateStreakMessageWithGemini(null, null, task.targetNickname);
          if (aiRes && aiRes.text) {
            contentToSend = aiRes.text;
            task.messageText = contentToSend;
          }
        } catch (e) {
          console.warn('Lỗi AI sinh câu giữ chuỗi:', e);
        }
      }

      try {
        const res = await sendTiktokMessage(
          task.cookieStr,
          task.conversationId,
          contentToSend,
          task.conversationType || 1,
          task.conversationShortId || ''
        );

        if (res.success) {
          task.status = 'SUCCESS';
          task.serverMsgId = res.serverMsgId || 'OK';
          task.resultMsg = `Gửi thành công (Msg ID: ${res.serverMsgId || 'OK'})`;

          // Thông báo kết quả ra Android
          nativeBackgroundService.showLocalNotification(
            'TikTokToe: Giữ chuỗi thành công',
            `Đã gửi tin nhắn tới ${task.targetNickname}: "${contentToSend}"`
          );
        } else {
          task.status = 'FAILED';
          task.resultMsg = `Thất bại: ${res.statusText || 'Lỗi không xác định'}`;

          nativeBackgroundService.showLocalNotification(
            'TikTokToe: Gửi giữ chuỗi thất bại',
            `Gửi tới ${task.targetNickname} thất bại: ${res.statusText || 'Lỗi phiên'}`
          );
        }
      } catch (err) {
        task.status = 'FAILED';
        task.resultMsg = `Lỗi mạng: ${err.message}`;

        nativeBackgroundService.showLocalNotification(
          'TikTokToe: Lỗi mạng giữ chuỗi',
          `Lỗi kết nối tới ${task.targetNickname}: ${err.message}`
        );
      }

      // Nếu người dùng chọn lặp lại mỗi ngày (giữ chuỗi TikTok)
      if (task.repeatDaily && task.status === 'SUCCESS') {
        const nextDayTime = task.scheduledTime + 24 * 60 * 60 * 1000;
        const nextTask = {
          ...task,
          id: `task_${Date.now()}_repeat`,
          scheduledTime: nextDayTime,
          status: 'PENDING',
          serverMsgId: null,
          resultMsg: '',
          createdAt: Date.now(),
          executedAt: null,
        };
        this.tasks.push(nextTask);

        // Đặt chuông báo thức Android cho ngày hôm sau
        nativeBackgroundService.scheduleExactAlarm(nextTask.id, nextDayTime);
      }

      await this.saveTasks();
      this.notify();
    } finally {
      this.runningTaskIds.delete(task.id);
      this.runningConvIds.delete(task.conversationId);
    }
  }

  /**
   * Thêm lịch hẹn mới
   */
  addTask({
    conversationId,
    conversationType = 1,
    conversationShortId = '',
    targetNickname = 'Người nhận',
    targetAvatar = '',
    messageText,
    scheduledTime, // timestamp (ms)
    repeatDaily = false,
    useAiDaily = false,
    cookieStr,
  }) {
    // 1. Tự động hủy và dọn dẹp MỌI task PENDING cũ của cuộc trò chuyện này (chống trùng lặp event)
    const oldPending = this.tasks.filter(
      (t) => t.conversationId === conversationId && t.status === 'PENDING'
    );
    for (const old of oldPending) {
      nativeBackgroundService.cancelExactAlarm(old.id);
    }
    this.tasks = this.tasks.filter(
      (t) => !(t.conversationId === conversationId && t.status === 'PENDING')
    );

    const newTask = {
      id: `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      conversationId,
      conversationType,
      conversationShortId,
      targetNickname,
      targetAvatar,
      messageText,
      scheduledTime,
      repeatDaily,
      useAiDaily,
      cookieStr,
      status: 'PENDING',
      resultMsg: '',
      serverMsgId: null,
      createdAt: Date.now(),
      executedAt: null,
    };

    this.tasks.push(newTask);
    this.saveTasks();

    // 1. Đặt chuông báo thức Android AlarmManager (chính xác từng giây kể cả khi tắt app)
    nativeBackgroundService.scheduleExactAlarm(newTask.id, scheduledTime);

    // 2. Nếu tùy chọn chạy ngầm đang bật, kích hoạt Foreground Service để giữ tiến trình
    if (this.isBgServiceEnabled) {
      nativeBackgroundService.startForegroundService(
        'TikTokToe • Tự động giữ chuỗi',
        `Có lịch hẹn gửi lúc ${new Date(scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} cho ${targetNickname}`
      );
    }

    this.startWorker();
    this.notify();
    return newTask;
  }

  /**
   * Hủy một tác vụ đang chờ
   */
  cancelTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task && task.status === 'PENDING') {
      task.status = 'CANCELLED';
      task.resultMsg = 'Đã hủy bởi người dùng';
      nativeBackgroundService.cancelExactAlarm(taskId);
      this.saveTasks();
      this.notify();
      return true;
    }
    return false;
  }

  /**
   * Xóa tác vụ khỏi danh sách
   */
  deleteTask(taskId) {
    nativeBackgroundService.cancelExactAlarm(taskId);
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    this.saveTasks();
    this.notify();
  }

  /**
   * Xóa toàn bộ tác vụ đã hoàn thành / đã hủy
   */
  clearCompletedTasks() {
    this.tasks = this.tasks.filter((t) => t.status === 'PENDING' || t.status === 'SENDING');
    this.saveTasks();
    this.notify();
  }

  /**
   * Lấy danh sách tác vụ (có thể lọc theo hội thoại)
   */
  getTasks(conversationId = null) {
    if (conversationId) {
      return this.tasks.filter((t) => t.conversationId === conversationId);
    }
    return [...this.tasks];
  }

  /**
   * Trả về Map các hội thoại có tác vụ đang chờ chạy (PENDING)
   */
  getActiveConversationMap() {
    const map = {};
    for (const t of this.tasks) {
      if (t.status === 'PENDING') {
        if (!map[t.conversationId]) {
          map[t.conversationId] = {
            hasSchedule: true,
            isStreak: !!t.repeatDaily,
            count: 1,
            nextTime: t.scheduledTime,
          };
        } else {
          map[t.conversationId].count += 1;
          if (t.repeatDaily) map[t.conversationId].isStreak = true;
          if (t.scheduledTime < map[t.conversationId].nextTime) {
            map[t.conversationId].nextTime = t.scheduledTime;
          }
        }
      }
    }
    return map;
  }

  /**
   * Đăng ký lắng nghe sự kiện thay đổi tác vụ / countdown
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.tasks);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.tasks);
      } catch (e) {
        console.warn('Lỗi listener worker:', e);
      }
    }
  }
}

// Khởi tạo Singleton duy nhất cho toàn bộ app
export const scheduleWorker = new ScheduleWorkerManager();
