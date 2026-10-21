/**
 * Headless JS Task Handler: Chạy tự động trong nền ngay cả khi app ĐÃ ĐÓNG HOÀN TOÀN!
 * Được kích hoạt bởi Android AlarmManager hoặc BootReceiver.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendTiktokMessage } from './tiktokApi';
import { generateStreakMessageWithGemini } from './geminiService';
import { nativeBackgroundService } from './nativeBackgroundService';

const STORAGE_KEY = 'TIKTOK_SCHEDULE_TASKS_V1';
const COOKIE_STORAGE_KEY = 'TIKTOK_ACTIVE_COOKIE_V1';

export async function handleHeadlessStreakTask(taskData) {
  console.log('[HeadlessJS] Bắt đầu chạy tác vụ ngầm:', taskData);

  try {
    // 1. Nạp danh sách task và cookie mới nhất từ AsyncStorage
    const [tasksJson, savedCookie] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      AsyncStorage.getItem(COOKIE_STORAGE_KEY),
    ]);

    if (!tasksJson) {
      console.log('[HeadlessJS] Không có task nào được lên lịch.');
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
      // Nếu sự kiện được kích hoạt cho 1 taskId cụ thể và task này không phải taskId đó -> bỏ qua
      if (targetedTaskId && task.id !== targetedTaskId && tasks.some((t) => t.id === targetedTaskId)) {
        continue;
      }

      // Chỉ xử lý các task PENDING đã đến giờ hoặc quá giờ hẹn
      if (task.status === 'PENDING' && now >= task.scheduledTime) {
        // 1. Chống trùng lặp trong cùng 1 lần chạy
        if (processedConvsInRun.has(task.conversationId)) {
          console.log(`[HeadlessJS] Cuộc trò chuyện ${task.conversationId} đã có tác vụ khác được xử lý trong lượt này. Hủy tác vụ thừa.`);
          task.status = 'CANCELLED';
          task.resultMsg = 'Hủy bỏ (trùng lịch với tác vụ khác)';
          hasChanges = true;
          continue;
        }

        const taskLockKey = `TASK_EXEC_LOCK_${task.id}`;
        const convLockKey = `CONV_LAST_SENT_${task.conversationId}`;

        // 2. Kiểm tra khoá phân tán với ScheduleWorker (trong app)
        const [taskLocked, convLocked] = await Promise.all([
          AsyncStorage.getItem(taskLockKey),
          AsyncStorage.getItem(convLockKey),
        ]);

        if (taskLocked && (now - parseInt(taskLocked, 10)) < 300000) {
          console.log(`[HeadlessJS] Task ${task.id} đã bị khóa bởi tiến trình khác. Bỏ qua.`);
          continue;
        }

        if (convLocked && (now - parseInt(convLocked, 10)) < 300000) {
          console.log(`[HeadlessJS] Cuộc trò chuyện ${task.conversationId} vừa được gửi tin trong 5 phút qua. Bỏ qua.`);
          task.status = 'CANCELLED';
          task.resultMsg = 'Bỏ qua (đã gửi trước đó bởi worker)';
          hasChanges = true;
          continue;
        }

        // Đánh dấu khoá ngay lập tức để chặn mọi luồng khác
        await Promise.all([
          AsyncStorage.setItem(taskLockKey, String(now)),
          AsyncStorage.setItem(convLockKey, String(now)),
        ]);
        processedConvsInRun.add(task.conversationId);

        console.log(`[HeadlessJS] Đang thực thi task hẹn giờ: ${task.id} (${task.targetNickname})`);
        task.status = 'SENDING';
        task.executedAt = Date.now();
        hasChanges = true;

        const effectiveCookie = savedCookie || task.cookieStr;
        let contentToSend = task.messageText;

        // Nếu bật AI tạo câu giữ chuỗi mỗi ngày
        if (task.useAiDaily) {
          try {
            const aiRes = await generateStreakMessageWithGemini(null, null, task.targetNickname);
            if (aiRes && aiRes.text) {
              contentToSend = aiRes.text;
              task.messageText = contentToSend;
            }
          } catch (aiErr) {
            console.warn('[HeadlessJS] Lỗi AI sinh câu:', aiErr);
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
            task.resultMsg = `Gửi thành công ngầm lúc ${new Date().toLocaleTimeString()} (Msg ID: ${res.serverMsgId || 'OK'})`;

            // Ban thong bao Android thong bao nguoi dung
            nativeBackgroundService.showLocalNotification(
              'TikTokToe: Giu chuoi thanh cong',
              `Da tu dong gui tin nhan toi ${task.targetNickname}: "${contentToSend}"`
            );

            // Neu lap lai hang ngay -> Len lich cho ngay tiep theo (+24h)
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

              // Dat chuong bao thuc Android cho ngay mai
              nativeBackgroundService.scheduleExactAlarm(nextTask.id, nextDayTime);
            }
          } else {
            task.status = 'FAILED';
            task.resultMsg = `That bai: ${res?.statusText || 'Loi khong xac dinh'}`;

            nativeBackgroundService.showLocalNotification(
              'TikTokToe: Gui giu chuoi that bai',
              `Khong the gui toi ${task.targetNickname}: ${res?.statusText || 'Loi phien'}`
            );
          }
        } catch (sendErr) {
          task.status = 'FAILED';
          task.resultMsg = `Loi mang: ${sendErr.message}`;

          nativeBackgroundService.showLocalNotification(
            'TikTokToe: Loi ket noi giu chuoi',
            `Loi gui toi ${task.targetNickname}: ${sendErr.message}`
          );
        }
      }
    }

    if (newTasksToAdd.length > 0) {
      tasks.push(...newTasksToAdd);
      hasChanges = true;
    }

    // 2. Tự động arm lại tất cả các task PENDING còn lại trong tương lai
    for (const t of tasks) {
      if (t.status === 'PENDING' && t.scheduledTime > now) {
        nativeBackgroundService.scheduleExactAlarm(t.id, t.scheduledTime);
      }
    }

    // 3. Lưu lại vào AsyncStorage
    if (hasChanges) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
      console.log('[HeadlessJS] Đã lưu cập nhật trạng thái tasks.');
    }
  } catch (err) {
    console.error('[HeadlessJS] Ngoại lệ thực thi:', err);
  }
}
