/**
 * Background Scheduler Worker for TikTok application
 * Combines 3 background tiers:
 * 1. Android Foreground Service: Prevents app process termination when swiped from recents
 * 2. Android AlarmManager (Exact Alarm + Headless JS): Wakes device at exact second to execute tasks
 * 3. In-App Timer: Real-time countdown on active user interface when app is in foreground
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

    // Load persisted tasks and preferences on initialization
    this.init();
  }

  async init() {
    await this.loadTasks();
    await this.loadBgPreference();
    this.startWorker();

    // Synchronize pending tasks to Android AlarmManager
    this.syncAllAlarmsToNative();

    // Automatically trigger Foreground Service if pending streak tasks exist
    if (this.isBgServiceEnabled && this.hasPendingTasks()) {
      nativeBackgroundService.startForegroundService();
    }
  }

  /**
   * Checks whether pending tasks exist in queue
   */
  hasPendingTasks() {
    return this.tasks.some((t) => t.status === 'PENDING');
  }

  /**
   * Loads persisted background service preferences
   */
  async loadBgPreference() {
    try {
      const val = await AsyncStorage.getItem(BG_PREF_KEY);
      if (val !== null) {
        this.isBgServiceEnabled = val === 'true';
      } else {
        this.isBgServiceEnabled = true; // Default ON to ensure streaks are maintained
      }
    } catch (_) {}
  }

  /**
   * Toggles Android Foreground Service persistence
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
   * Loads task queue from AsyncStorage
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
                t.resultMsg = 'Cancelled (cleaned duplicate schedule)';
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
      console.warn('[ScheduleWorker] Error loading tasks from AsyncStorage:', e);
    } finally {
      this.isLoaded = true;
    }
  }

  /**
   * Persists task queue to AsyncStorage
   */
  async saveTasks() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch (e) {
      console.warn('[ScheduleWorker] Error saving tasks to AsyncStorage:', e);
    }
  }

  /**
   * Updates session cookie string for all pending tasks
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
   * Synchronizes all PENDING tasks to Android AlarmManager
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
   * Starts in-app polling timer (runs every 2000ms while app is active)
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
   * Real-time polling tick
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

      if (hasExecuted) {
        this.notify();
      }
    } finally {
      this.isTicking = false;
    }
  }

  /**
   * Checks and immediately executes all overdue tasks
   * Invoked on app launch and foreground return
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
   * Executes scheduled task when trigger time is reached
   */
  async executeTask(task) {
    if (task.status !== 'PENDING') return;

    // In-memory concurrency guard (Single Thread Protection)
    if (this.runningTaskIds.has(task.id) || this.runningConvIds.has(task.conversationId)) {
      console.log(`[ScheduleWorker] Task ${task.id} or conversation ${task.conversationId} is currently executing. Skipping.`);
      return;
    }
    this.runningTaskIds.add(task.id);
    this.runningConvIds.add(task.conversationId);

    try {
      const now = Date.now();
      const taskLockKey = `TASK_EXEC_LOCK_${task.id}`;
      const convLockKey = `CONV_LAST_SENT_${task.conversationId}`;

      // Distributed locks preventing concurrent HeadlessJS race condition
      const [taskLocked, convLocked] = await Promise.all([
        AsyncStorage.getItem(taskLockKey),
        AsyncStorage.getItem(convLockKey),
      ]);

      if (taskLocked && (now - parseInt(taskLocked, 10)) < 300000) {
        console.log(`[ScheduleWorker] Task ${task.id} is locked by another process. Skipping.`);
        return;
      }

      if (convLocked && (now - parseInt(convLocked, 10)) < 300000) {
        console.log(`[ScheduleWorker] Conversation ${task.conversationId} messaged within last 5 minutes. Skipping duplicate.`);
        task.status = 'CANCELLED';
        task.resultMsg = 'Skipped (already sent previously)';
        this.saveTasks();
        return;
      }

      // Acquire lock immediately
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
          console.warn('Gemini AI streak message generation error:', e);
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
          task.resultMsg = `Successfully sent (Msg ID: ${res.serverMsgId || 'OK'})`;

          // Local Android notification
          nativeBackgroundService.showLocalNotification(
            'TikTokToe: Streak Sent Successfully',
            `Sent message to ${task.targetNickname}: "${contentToSend}"`
          );
        } else {
          task.status = 'FAILED';
          task.resultMsg = `Failed: ${res.statusText || 'Unknown error'}`;

          nativeBackgroundService.showLocalNotification(
            'TikTokToe: Streak Send Failed',
            `Sending to ${task.targetNickname} failed: ${res.statusText || 'Session error'}`
          );
        }
      } catch (err) {
        task.status = 'FAILED';
        task.resultMsg = `Network error: ${err.message}`;

        nativeBackgroundService.showLocalNotification(
          'TikTokToe: Network Connection Error',
          `Connection error to ${task.targetNickname}: ${err.message}`
        );
      }

      // Schedule for next 24-hour cycle if repeatDaily is enabled
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

        // Schedule next AlarmManager trigger
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
   * Adds new scheduled task
   */
  addTask({
    conversationId,
    conversationType = 1,
    conversationShortId = '',
    targetNickname = 'Recipient',
    targetAvatar = '',
    messageText,
    scheduledTime, // timestamp (ms)
    repeatDaily = false,
    useAiDaily = false,
    cookieStr,
  }) {
    // Automatically cancel prior PENDING tasks for this conversation to prevent duplicate triggers
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

    // 1. Arm Android AlarmManager for second-accurate execution
    nativeBackgroundService.scheduleExactAlarm(newTask.id, scheduledTime);

    // 2. Start Foreground Service if background persistence is enabled
    if (this.isBgServiceEnabled) {
      nativeBackgroundService.startForegroundService(
        'TikTokToe: Automated Streak Keeper',
        `Scheduled message at ${new Date(scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${targetNickname}`
      );
    }

    this.startWorker();
    this.notify();
    return newTask;
  }

  /**
   * Cancels pending task
   */
  cancelTask(taskId) {
    const task = this.tasks.find((t) => t.id === taskId);
    if (task && task.status === 'PENDING') {
      task.status = 'CANCELLED';
      task.resultMsg = 'Cancelled by user';
      nativeBackgroundService.cancelExactAlarm(taskId);
      this.saveTasks();
      this.notify();
      return true;
    }
    return false;
  }

  /**
   * Deletes task from list
   */
  deleteTask(taskId) {
    nativeBackgroundService.cancelExactAlarm(taskId);
    this.tasks = this.tasks.filter((t) => t.id !== taskId);
    this.saveTasks();
    this.notify();
  }

  /**
   * Clears all completed or cancelled tasks
   */
  clearCompletedTasks() {
    this.tasks = this.tasks.filter((t) => t.status === 'PENDING' || t.status === 'SENDING');
    this.saveTasks();
    this.notify();
  }

  /**
   * Retrieves tasks (optionally filtered by conversation ID)
   */
  getTasks(conversationId = null) {
    if (conversationId) {
      return this.tasks.filter((t) => t.conversationId === conversationId);
    }
    return [...this.tasks];
  }

  /**
   * Returns conversation map of currently PENDING tasks
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
   * Subscribes listener to task queue updates
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
        console.warn('Worker listener error:', e);
      }
    }
  }
}

// Global Singleton Instance
export const scheduleWorker = new ScheduleWorkerManager();
