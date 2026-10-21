/**
 * Headless JS Task Handler: Runs automatically in background even when the app is completely closed.
 * Triggered by Android AlarmManager or BootReceiver.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendTiktokMessage } from './tiktokApi';
import { generateStreakMessageWithGemini } from './geminiService';
import { nativeBackgroundService } from './nativeBackgroundService';
import { getRandomVideoByKeyword } from './tiktokSearchService';

const STORAGE_KEY = 'TIKTOK_SCHEDULE_TASKS_V1';
const COOKIE_STORAGE_KEY = 'TIKTOK_ACTIVE_COOKIE_V1';

export async function handleHeadlessStreakTask(taskData) {
  console.log('[HeadlessJS] Starting background headless task execution:', taskData);

  try {
    // 1. Load latest task queue and persisted cookies from AsyncStorage
    const [tasksJson, savedCookie] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(COOKIE_STORAGE_KEY),
    ]);

    if (!tasksJson) {
      console.log('[HeadlessJS] No scheduled tasks found in storage.');
      return;
    }

    let tasks = [];
    try {
      tasks = JSON.parse(tasksJson);
    } catch (_) {
      return;
    }

    if (!Array.isArray(tasks) || tasks.length === 0) return;

    const now = Date.now();
    let hasChanges = false;
    const newTasksToAdd = [];
    const processedConvsInRun = new Set();
    const targetedTaskId = taskData && typeof taskData === 'object' ? taskData.taskId : null;

    for (const task of tasks) {
      // If event was targeted to a specific taskId, skip unrelated tasks
      if (targetedTaskId && task.id !== targetedTaskId && tasks.some((t) => t.id === targetedTaskId)) {
        continue;
      }

      // Process only PENDING tasks whose scheduled time has arrived or elapsed
      if (task.status === 'PENDING' && now >= task.scheduledTime) {
        // Anti-duplicate protection within single execution run
        if (processedConvsInRun.has(task.conversationId)) {
          console.log(`[HeadlessJS] Conversation ${task.conversationId} already processed in this run. Cancelling duplicate.`);
          task.status = 'CANCELLED';
          task.resultMsg = 'Cancelled (duplicate schedule)';
          hasChanges = true;
          continue;
        }

        const taskLockKey = `TASK_EXEC_LOCK_${task.id}`;
        const convLockKey = `CONV_LAST_SENT_${task.conversationId}`;

        // Verify distributed locks against active in-app ScheduleWorker
        const [taskLocked, convLocked] = await Promise.all([
          AsyncStorage.getItem(taskLockKey),
          AsyncStorage.getItem(convLockKey),
        ]);

        if (taskLocked && (now - parseInt(taskLocked, 10)) < 300000) {
          console.log(`[HeadlessJS] Task ${task.id} is locked by another process. Skipping.`);
          continue;
        }

        if (convLocked && (now - parseInt(convLocked, 10)) < 300000) {
          console.log(`[HeadlessJS] Conversation ${task.conversationId} was messaged within the last 5 minutes. Skipping.`);
          task.status = 'CANCELLED';
          task.resultMsg = 'Skipped (recently sent by worker)';
          hasChanges = true;
          continue;
        }

        // Acquire lock immediately to prevent race conditions
        await Promise.all([
          AsyncStorage.setItem(taskLockKey, String(now)),
          AsyncStorage.setItem(convLockKey, String(now)),
        ]);
        processedConvsInRun.add(task.conversationId);

        console.log(`[HeadlessJS] Executing scheduled task: ${task.id} (${task.targetNickname})`);
        task.status = 'SENDING';
        task.executedAt = Date.now();
        hasChanges = true;

        const effectiveCookie = savedCookie || task.cookieStr;
        let contentToSend = task.messageText;

        // Handle Random Video Mode by Keyword
        if (task.sendVideoMode) {
          try {
            const video = await getRandomVideoByKeyword(
              task.videoKeyword || 'hai huoc',
              effectiveCookie,
              task.conversationId
            );
            if (video && video.url) {
              contentToSend = video;
              task.sentVideoUrl = video.url;
              task.sentVideoTitle = video.desc || '';
              task.messageText = video.desc || video.url;
            }
          } catch (vidErr) {
            console.warn('[HeadlessJS] Error getting random video:', vidErr);
          }
        } else if (task.useAiDaily) {
          // Generate dynamic content via Gemini AI if enabled
          try {
            const aiRes = await generateStreakMessageWithGemini(null, null, task.targetNickname);
            if (aiRes && aiRes.text) {
              contentToSend = aiRes.text;
              task.messageText = contentToSend;
            }
          } catch (aiErr) {
            console.warn('[HeadlessJS] Gemini AI generation error:', aiErr);
          }
        }

        try {
          const res = await sendTiktokMessage(
            effectiveCookie,
            task.conversationId,
            contentToSend,
            task.conversationType || 1,
            task.conversationShortId || ''
          );

          if (res && res.success) {
            task.status = 'SUCCESS';
            task.serverMsgId = res.serverMsgId || 'OK';
            task.resultMsg = `Sent in background at ${new Date().toLocaleTimeString()} (Msg ID: ${res.serverMsgId || 'OK'})`;

            // Trigger local Android notification
            nativeBackgroundService.showLocalNotification(
              'TikTokToe: Streak Sent Successfully',
              `Automatically sent message to ${task.targetNickname}: "${contentToSend}"`
            );

            // Re-arm for next day if configured for daily recurrence
            if (task.repeatDaily) {
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
              newTasksToAdd.push(nextTask);

              // Register AlarmManager alarm for tomorrow
              nativeBackgroundService.scheduleExactAlarm(nextTask.id, nextDayTime);
            }
          } else {
            task.status = 'FAILED';
            task.resultMsg = `Failed: ${res?.statusText || 'Unknown error'}`;

            nativeBackgroundService.showLocalNotification(
              'TikTokToe: Streak Send Failed',
              `Could not send message to ${task.targetNickname}: ${res?.statusText || 'Session error'}`
            );
          }
        } catch (sendErr) {
          task.status = 'FAILED';
          task.resultMsg = `Network error: ${sendErr.message}`;

          nativeBackgroundService.showLocalNotification(
            'TikTokToe: Network Connection Error',
            `Error sending message to ${task.targetNickname}: ${sendErr.message}`
          );
        }
      }
    }

    if (newTasksToAdd.length > 0) {
      tasks.push(...newTasksToAdd);
      hasChanges = true;
    }

    // 2. Re-arm remaining future PENDING tasks
    for (const t of tasks) {
      if (t.status === 'PENDING' && t.scheduledTime > now) {
        nativeBackgroundService.scheduleExactAlarm(t.id, t.scheduledTime);
      }
    }

    // 3. Persist updated queue to AsyncStorage
    if (hasChanges) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      console.log('[HeadlessJS] Task status updates persisted to storage.');
    }
  } catch (err) {
    console.error('[HeadlessJS] Execution exception:', err);
  }
}
