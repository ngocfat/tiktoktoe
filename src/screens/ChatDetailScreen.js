import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  SafeAreaView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendTiktokMessage } from '../services/tiktokApi';
import { scheduleWorker } from '../services/scheduleWorker';
import { useTheme } from '../constants/ThemeContext';
import { generateStreakMessageWithGemini } from '../services/geminiService';
import { previewSearchVideo, TIKTOK_EXPLORE_CATEGORIES } from '../services/tiktokSearchService';

export default function ChatDetailScreen({ conversation, cookieStr, onBack }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  // Mode toggle: Auto Send vs Scheduled Worker
  const [activeTab, setActiveTab] = useState('AUTO_SEND'); // 'AUTO_SEND' | 'SCHEDULE'

  // Unlocked speed mode (default: Safe Mode = false)
  const [unlockedMode, setUnlockedMode] = useState(false);

  // --- AUTO SEND CONFIGURATION ---
  const [messageTemplate, setMessageTemplate] = useState('Chào bạn, đây là tin nhắn tự động test!');
  const [totalCount, setTotalCount] = useState('5');
  const [delaySeconds, setDelaySeconds] = useState('5');
  const [appendCounter, setAppendCounter] = useState(true);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 });
  const [logs, setLogs] = useState([]);

  // --- SCHEDULE WORKER CONFIGURATION ---
  const now = new Date();
  const defaultHour = String((now.getHours() + (now.getMinutes() >= 55 ? 1 : 0)) % 24).padStart(2, '0');
  const defaultMin = String((now.getMinutes() + 5) % 60).padStart(2, '0');

  const [scheduleContentType, setScheduleContentType] = useState('TEXT'); // 'TEXT' | 'VIDEO'
  const [videoKeyword, setVideoKeyword] = useState('hai huoc');
  const [isPreviewingVideo, setIsPreviewingVideo] = useState(false);
  const [previewVideoData, setPreviewVideoData] = useState(null);

  const [scheduleMsg, setScheduleMsg] = useState('Chào bạn, đây là tin nhắn hẹn giờ tự động!');
  const [targetHour, setTargetHour] = useState(defaultHour);
  const [targetMinute, setTargetMinute] = useState(defaultMin);
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [useAiDaily, setUseAiDaily] = useState(true);
  const [scheduledTasks, setScheduledTasks] = useState([]);

  // Gemini AI suggestion state
  const [isGeneratingAiAuto, setIsGeneratingAiAuto] = useState(false);
  const [isGeneratingAiSchedule, setIsGeneratingAiSchedule] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const isStopRequested = useRef(false);
  const logScrollRef = useRef(null);

  // Subscribe to background worker updates
  useEffect(() => {
    const unsubscribe = scheduleWorker.subscribe((allTasks) => {
      const convTasks = allTasks.filter(
        (t) => t.conversationId === conversation.conversationId
      );
      setScheduledTasks(convTasks);
    });
    return unsubscribe;
  }, [conversation.conversationId]);

  // Load speed unlock mode (Safe Mode vs Unlocked Mode)
  useEffect(() => {
    AsyncStorage.getItem('TIKTOKTOE_UNLOCKED_SPEED_MODE').then((val) => {
      const isUnlocked = val === 'true';
      setUnlockedMode(isUnlocked);
      if (!isUnlocked) {
        setTotalCount((prev) => {
          const n = parseInt(prev, 10);
          return (!isNaN(n) && n > 5) ? '5' : prev;
        });
        setDelaySeconds((prev) => {
          const d = parseFloat(prev);
          return (!isNaN(d) && d < 5) ? '5' : (prev === '2' ? '5' : prev);
        });
        setAppendCounter(true);
      }
    });
  }, []);

  const addLog = (text, type = 'info') => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs((prev) => [...prev, { time: timeStr, text, type }]);
  };

  useEffect(() => {
    if (logScrollRef.current) {
      logScrollRef.current.scrollToEnd({ animated: true });
    }
  }, [logs]);

  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // Send a single test message
  const handleSendSingle = async () => {
    if (!messageTemplate.trim()) {
      Alert.alert('Cảnh báo', 'Vui lòng nhập nội dung tin nhắn!');
      return;
    }

    addLog('Đang gửi tin thử nghiệm...', 'info');

    try {
      const convType = conversation.conversationType || 1;
      const shortId =
        conversation.conversationShortId || (conversation.isGroup ? conversation.conversationId : '');
      const res = await sendTiktokMessage(
        cookieStr,
        conversation.conversationId,
        messageTemplate.trim(),
        convType,
        shortId
      );

      if (res.success) {
        addLog(`Gửi thành công! (Server ID: ${res.serverMsgId || 'OK'})`, 'success');
      } else {
        addLog(`Thất bại: ${res.statusText || 'Lỗi không xác định'}`, 'error');

        const statusTextLower = String(res.statusText || '').toLowerCase();
        if (
          res.msgStatus === 2 ||
          statusTextLower.includes('vi phạm') ||
          statusTextLower.includes('cộng đồng') ||
          statusTextLower.includes('ban') ||
          statusTextLower.includes('tiêu chuẩn')
        ) {
          Alert.alert(
            '[Canh bao] TikTok Tam Han Che Nhan Tin',
            `TikTok da tu choi gui tin: "${res.statusText}".\n\nTai khoan dang bi TikTok ap lenh han che tren nen tang Web do tan suat gui truoc do. Khuyen nghi tam ngung gui tu dong 24h-48h de tai khoan tu hoi phuc.`
          );
        }
      }
    } catch (err) {
      addLog(`Ngoại lệ: ${err.message}`, 'error');
    }
  };

  // Execute auto send loop
  const doExecuteAutoSend = async (count, delay) => {
    isStopRequested.current = false;
    setIsRunning(true);
    setProgress({ current: 0, total: count, success: 0, failed: 0 });
    addLog(`Bắt đầu gửi tự động ${count} tin (Delay: ${delay}s)...`, 'info');

    let successCount = 0;
    let failedCount = 0;

    for (let i = 1; i <= count; i++) {
      if (isStopRequested.current) {
        addLog('Người dùng đã chủ động dừng gửi.', 'warning');
        break;
      }

      let currentText = messageTemplate.trim();
      const shouldAppend = !unlockedMode || appendCounter;
      if (shouldAppend) {
        const randId = Math.floor(100 + Math.random() * 900);
        currentText = `${currentText} (#${i} - ${randId})`;
      }

      setProgress({
        current: i,
        total: count,
        success: successCount,
        failed: failedCount,
      });

      addLog(`[${i}/${count}] Đang gửi: "${currentText}"`, 'info');

      try {
        const convType = conversation.conversationType || 1;
        const shortId =
          conversation.conversationShortId || (conversation.isGroup ? conversation.conversationId : '');
        const res = await sendTiktokMessage(
          cookieStr,
          conversation.conversationId,
          currentText,
          convType,
          shortId
        );

        if (res.success) {
          successCount++;
          addLog(`  -> Thành công (Server ID: ${res.serverMsgId || 'OK'})`, 'success');
        } else {
          failedCount++;
          addLog(`  -> Thất bại: ${res.statusText}`, 'error');

          const statusTextLower = String(res.statusText || '').toLowerCase();
          const isBannedOrFiltered =
            res.msgStatus === 2 ||
            statusTextLower.includes('vi phạm') ||
            statusTextLower.includes('cộng đồng') ||
            statusTextLower.includes('ban') ||
            statusTextLower.includes('tiêu chuẩn');

          if (isBannedOrFiltered) {
            isStopRequested.current = true;
            addLog(`[Canh bao] TikTok ap lenh han che (${res.statusText}). Tu dong ngat khan cap de bao ve tai khoan!`, 'error');
            Alert.alert(
              '[Canh bao] TikTok Tam Han Che Nhan Tin',
              `TikTok da tu choi gui tin nhan: "${res.statusText}".\n\nUng dung da tu dong dung cac tin con lai de tranh lam lenh cam bi keo dai. Ban nen tam ngung gui tu dong trong 24h-48h de tai khoan hoi phuc.`
            );
            break;
          }
        }
      } catch (err) {
        failedCount++;
        addLog(`  -> Lỗi mạng: ${err.message}`, 'error');
      }

      setProgress({
        current: i,
        total: count,
        success: successCount,
        failed: failedCount,
      });

      if (i < count && !isStopRequested.current) {
        addLog(`Chờ ${delay}s...`, 'muted');
        await waitMs(delay * 1000);
      }
    }

    setIsRunning(false);
    addLog(`Hoàn thành phiên gửi! Thành công: ${successCount}, Thất bại: ${failedCount}`, 'success');
  };

  // Start continuous auto send loop
  const handleStartAutoSend = async () => {
    let count = parseInt(totalCount, 10);
    let delay = parseFloat(delaySeconds);

    if (isNaN(count) || count <= 0) {
      Alert.alert('Lỗi', 'Số lần gửi phải là số nguyên lớn hơn 0!');
      return;
    }

    if (!messageTemplate.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập nội dung tin nhắn!');
      return;
    }

    if (!unlockedMode) {
      // Safe Mode barrier
      if (count > 5) {
        Alert.alert(
          'Chế Độ An Toàn (Safe Mode)',
          'Để bảo vệ tài khoản khỏi bộ lọc spam của TikTok, số lần gửi tối đa ở Chế độ an toàn là 5 tin.\n\nNếu bạn hiểu rõ rủi ro và muốn gửi nhiều hơn, hãy vào "Cài đặt" để bật "Mở khóa giới hạn tốc độ".'
        );
        setTotalCount('5');
        return;
      }
      if (delay < 5) {
        Alert.alert(
          'Chế Độ An Toàn (Safe Mode)',
          'Độ trễ tối thiểu ở Chế độ an toàn là 5 giây/tin để bảo vệ tài khoản.\n\nNếu bạn hiểu rõ rủi ro và muốn gửi nhanh hơn, hãy vào "Cài đặt" để bật "Mở khóa giới hạn tốc độ".'
        );
        setDelaySeconds('5');
        return;
      }
    } else {
      // Unlocked mode: check dangerous parameters and prompt confirmation
      if (count > 5 || delay < 3) {
        Alert.alert(
          '[Xac Nhan] Gui Toc Do Cao',
          `Bạn đang chuẩn bị gửi ${count} tin với tốc độ ${delay}s/tin ở Chế độ tự do.\n\nTần suất này có nguy cơ rất cao khiến TikTok gắn cờ spam và hạn chế nhắn tin nick của bạn.\n\nBạn có chắc chắn muốn tiếp tục không?`,
          [
            { text: 'Hủy bỏ', style: 'cancel' },
            {
              text: 'Vẫn gửi (Chấp nhận rủi ro)',
              style: 'destructive',
              onPress: () => doExecuteAutoSend(count, delay),
            },
          ]
        );
        return;
      }
    }

    doExecuteAutoSend(count, delay);
  };

  const handleStop = () => {
    isStopRequested.current = true;
    addLog('Đang yêu cầu dừng...', 'warning');
  };

  // --- GEMINI AI STREAK MESSAGE SUGGESTION ---
  const handleGenerateAiForAuto = async () => {
    setIsGeneratingAiAuto(true);
    try {
      const res = await generateStreakMessageWithGemini(null, null, conversation.nickname);
      if (res && res.text) {
        setMessageTemplate(res.text);
        addLog(`Gemini AI gợi ý: "${res.text}"`, 'info');
      }
    } catch (e) {
      addLog(`Lỗi gọi Gemini AI: ${e.message}`, 'error');
    } finally {
      setIsGeneratingAiAuto(false);
    }
  };

  const handleGenerateAiForSchedule = async () => {
    setIsGeneratingAiSchedule(true);
    try {
      const res = await generateStreakMessageWithGemini(null, null, conversation.nickname);
      if (res && res.text) {
        setScheduleMsg(res.text);
      }
    } catch (e) {
      Alert.alert('Lỗi', `Không thể tạo câu từ Gemini: ${e.message}`);
    } finally {
      setIsGeneratingAiSchedule(false);
    }
  };

  // --- SCHEDULE WORKER ACTIONS ---
  const handleTestPreviewVideo = async () => {
    if (isPreviewingVideo) return;
    const kw = videoKeyword.trim() || 'hai huoc';
    setIsPreviewingVideo(true);
    setPreviewVideoData(null);
    try {
      const vid = await previewSearchVideo(kw, cookieStr);
      if (vid && vid.url) {
        setPreviewVideoData(vid);
      } else {
        Alert.alert('Thong bao', 'Khong tim thay video mau phu hop. Vui long thu tu khoa khac!');
      }
    } catch (err) {
      Alert.alert('Loi', `Khong the tim kiem video: ${err.message}`);
    } finally {
      setIsPreviewingVideo(false);
    }
  };

  const applyQuickTimePreset = (minutesToAdd) => {
    const future = new Date(Date.now() + minutesToAdd * 60 * 1000);
    setTargetHour(String(future.getHours()).padStart(2, '0'));
    setTargetMinute(String(future.getMinutes()).padStart(2, '0'));
  };

  const handleCreateSchedule = () => {
    if (isScheduling) return;

    const isVideo = scheduleContentType === 'VIDEO';
    const finalKeyword = videoKeyword.trim() || 'hai huoc';

    if (!isVideo && !scheduleMsg.trim()) {
      Alert.alert('Loi', 'Vui long nhap noi dung tin nhan can hen gio!');
      return;
    }

    if (isVideo && !videoKeyword.trim()) {
      Alert.alert('Loi', 'Vui long nhap hoac chon tu khoa video can tim kiem!');
      return;
    }

    const h = parseInt(targetHour, 10);
    const m = parseInt(targetMinute, 10);

    if (isNaN(h) || h < 0 || h > 23 || isNaN(m) || m < 0 || m > 59) {
      Alert.alert('Loi', 'Gio hen khong hop le (Gio: 0-23, Phut: 0-59)!');
      return;
    }

    setIsScheduling(true);

    const targetDate = new Date();
    targetDate.setHours(h, m, 0, 0);

    // If target time has passed today, schedule for tomorrow
    if (targetDate.getTime() <= Date.now()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const shortId =
      conversation.conversationShortId || (conversation.isGroup ? conversation.conversationId : '');

    scheduleWorker.addTask({
      conversationId: conversation.conversationId,
      conversationType: conversation.conversationType || 1,
      conversationShortId: shortId,
      targetNickname: conversation.nickname,
      targetAvatar: conversation.avatar,
      messageText: isVideo ? `[VIDEO: ${finalKeyword}]` : scheduleMsg.trim(),
      sendVideoMode: isVideo,
      videoKeyword: isVideo ? finalKeyword : '',
      scheduledTime: targetDate.getTime(),
      repeatDaily: repeatDaily,
      useAiDaily: !isVideo && repeatDaily && useAiDaily,
      cookieStr: cookieStr,
    });

    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    Alert.alert(
      'Thanh cong',
      isVideo
        ? `Da len lich tu dong tim video "${finalKeyword}" va gui vao luc ${timeStr} ${targetDate.getDate()}/${targetDate.getMonth() + 1}!`
        : `Da len lich gui tin nhan vao luc ${timeStr} ${targetDate.getDate()}/${targetDate.getMonth() + 1}!`
    );

    setTimeout(() => {
      setIsScheduling(false);
    }, 800);
  };

  const formatCountdown = (targetMs) => {
    const diff = Math.max(0, Math.floor((targetMs - Date.now()) / 1000));
    const hours = Math.floor(diff / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.iconColor} />
        </TouchableOpacity>

        <View style={styles.headerUser}>
          {conversation.avatar ? (
            <Image source={{ uri: conversation.avatar }} style={styles.headerAvatar} />
          ) : (
            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: theme.surface }]}>
              <Text style={[styles.headerAvatarInitial, { color: theme.textPrimary }]}>
                {conversation.nickname.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.headerUserText}>
            <Text style={[styles.headerNickname, { color: theme.textPrimary }]} numberOfLines={1}>
              {conversation.nickname}
            </Text>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]} numberOfLines={1}>
              {conversation.isGroup ? 'Nhóm trò chuyện' : `@${conversation.uniqueId || conversation.targetUid}`}
            </Text>
          </View>
        </View>

        {/* Theme switch button */}
        <TouchableOpacity
          style={[styles.themeToggleBtn, { backgroundColor: theme.surface }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDarkMode ? 'sunny-outline' : 'moon'}
            size={18}
            color={isDarkMode ? '#F59E0B' : '#8B5CF6'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {/* Target conversation card */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Thông Tin Đoạn Chat</Text>
          </View>
          <Text
            style={[styles.lastMsgText, { color: theme.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Tin mới nhất: "{conversation.lastMessageText}"
          </Text>
          <Text style={[styles.cidText, { color: theme.textMuted }]}>
            ID: {conversation.conversationId}
          </Text>
        </View>

        {/* Mode tabs: Auto Send vs Schedule Worker */}
        <View style={[styles.tabBar, { backgroundColor: theme.surface }]}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'AUTO_SEND' && { backgroundColor: theme.tiktokRed },
            ]}
            onPress={() => setActiveTab('AUTO_SEND')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flash"
              size={15}
              color={activeTab === 'AUTO_SEND' ? '#FFFFFF' : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'AUTO_SEND' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Gửi Tự Động (Lặp)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === 'SCHEDULE' && { backgroundColor: theme.tiktokRed },
            ]}
            onPress={() => setActiveTab('SCHEDULE')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="time"
              size={15}
              color={activeTab === 'SCHEDULE' ? '#FFFFFF' : theme.textSecondary}
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'SCHEDULE' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Hẹn Giờ Gửi (Worker)
            </Text>
          </TouchableOpacity>
        </View>

        {/* ===================== TAB 1: CONTINUOUS AUTO SEND ===================== */}
        {activeTab === 'AUTO_SEND' ? (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="flash-outline" size={16} color={theme.tiktokRed} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Cấu Hình Gửi Tự Động</Text>
            </View>

            {/* Mode status banner */}
            <View
              style={[
                styles.safeModeBanner,
                {
                  backgroundColor: unlockedMode
                    ? (isDarkMode ? 'rgba(239, 68, 68, 0.12)' : '#FEE2E2')
                    : (isDarkMode ? 'rgba(16, 185, 129, 0.12)' : '#ECFDF5'),
                },
              ]}
            >
              <Ionicons
                name={unlockedMode ? 'warning-outline' : 'shield-checkmark-outline'}
                size={16}
                color={unlockedMode ? '#EF4444' : '#10B981'}
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.safeModeBannerText,
                  { color: unlockedMode ? '#EF4444' : (isDarkMode ? '#34D399' : '#059669') },
                ]}
              >
                {unlockedMode ? (
                  <Text>
                    <Text style={{ fontWeight: '700' }}>Chế độ tự do:</Text> Đã mở khóa tốc độ. Cẩn trọng tránh bị khóa nick!
                  </Text>
                ) : (
                  <Text>
                    <Text style={{ fontWeight: '700' }}>Safe Mode:</Text> Tối đa 5 tin, trễ tối thiểu 5s để chống spam.
                  </Text>
                )}
              </Text>
            </View>

            <View style={styles.labelWithAiRow}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nội dung tin nhắn:</Text>
              <TouchableOpacity
                style={[
                  styles.aiSuggestBtn,
                  { backgroundColor: theme.surface },
                ]}
                onPress={handleGenerateAiForAuto}
                disabled={isGeneratingAiAuto || isRunning}
                activeOpacity={0.7}
              >
                {isGeneratingAiAuto ? (
                  <ActivityIndicator size="small" color={theme.tiktokRed} />
                ) : (
                  <>
                    <Ionicons name="sparkles" size={12} color={theme.tiktokRed} style={{ marginRight: 4 }} />
                    <Text style={[styles.aiSuggestBtnText, { color: theme.tiktokRed }]}>Gemini AI gợi ý</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.inputBg,
                  color: theme.textPrimary,
                },
              ]}
              multiline
              numberOfLines={3}
              value={messageTemplate}
              onChangeText={setMessageTemplate}
              placeholder="Nhập nội dung tin nhắn gửi tự động..."
              placeholderTextColor={theme.textMuted}
              editable={!isRunning}
            />

            <View style={styles.inputGrid}>
              <View style={styles.gridCol}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Số lần gửi:</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBg,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={totalCount}
                  onChangeText={(val) => {
                    if (!unlockedMode) {
                      const num = parseInt(val, 10);
                      if (!isNaN(num) && num > 5) {
                        Alert.alert(
                          'Chế Độ An Toàn (Safe Mode)',
                          'Số lần gửi tối đa ở Chế độ an toàn là 5 tin. Vui lòng mở khóa trong Cài đặt nếu bạn muốn gửi nhiều hơn.'
                        );
                        setTotalCount('5');
                        return;
                      }
                    }
                    setTotalCount(val);
                  }}
                  placeholder={unlockedMode ? '5' : 'Tối đa 5'}
                  placeholderTextColor={theme.textMuted}
                  editable={!isRunning}
                />
              </View>

              <View style={styles.gridCol}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>Delay mỗi tin (giây):</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBg,
                      color: theme.textPrimary,
                    },
                  ]}
                  keyboardType="numeric"
                  value={delaySeconds}
                  onChangeText={(val) => {
                    setDelaySeconds(val);
                  }}
                  onBlur={() => {
                    if (!unlockedMode) {
                      const num = parseFloat(delaySeconds);
                      if (isNaN(num) || num < 5) {
                        setDelaySeconds('5');
                      }
                    }
                  }}
                  placeholder={unlockedMode ? '5' : 'Tối thiểu 5s'}
                  placeholderTextColor={theme.textMuted}
                  editable={!isRunning}
                />
              </View>
            </View>

            <View style={[styles.switchRow, { borderTopColor: theme.divider }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                  Chống trùng lặp tin nhắn
                </Text>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>
                  {!unlockedMode
                    ? 'Bắt buộc BẬT ở Safe Mode để vượt qua bộ lọc spam của TikTok'
                    : 'Tự động nối (#1 - xxx) ngẫu nhiên để vượt bộ lọc spam của TikTok'}
                </Text>
              </View>
              <Switch
                value={!unlockedMode ? true : appendCounter}
                onValueChange={(val) => {
                  if (!unlockedMode) {
                    Alert.alert(
                      'Safe Mode',
                      'Tính năng chống trùng lặp bắt buộc bật ở Safe Mode để bảo vệ tài khoản khỏi bộ lọc của TikTok.'
                    );
                    return;
                  }
                  setAppendCounter(val);
                }}
                disabled={!unlockedMode || isRunning}
                trackColor={{ false: theme.surface, true: theme.tiktokRed }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.btnSingle,
                  { backgroundColor: theme.surface },
                ]}
                onPress={handleSendSingle}
                disabled={isRunning}
                activeOpacity={0.7}
              >
                <Ionicons name="paper-plane-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
                <Text style={[styles.btnSingleText, { color: theme.textPrimary }]}>Gửi Thử 1 Tin</Text>
              </TouchableOpacity>

              {!isRunning ? (
                <TouchableOpacity
                  style={[styles.btnStart, { backgroundColor: theme.tiktokRed }]}
                  onPress={handleStartAutoSend}
                  activeOpacity={0.8}
                >
                  <Ionicons name="play" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnStartText}>Bắt Đầu Gửi Tự Động</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.btnStart, { backgroundColor: '#EF4444' }]}
                  onPress={handleStop}
                  activeOpacity={0.8}
                >
                  <Ionicons name="stop" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.btnStartText}>Dừng Ngay</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : (
          /* ===================== TAB 2: SCHEDULED WORKER ===================== */
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="alarm-outline" size={18} color={theme.tiktokRed} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Worker Hẹn Giờ Giữ Chuỗi</Text>
            </View>

            {/* Content Type Selector: Text vs Random Video by Keyword */}
            <View style={[styles.contentTypeSegmentRow, { backgroundColor: theme.surface }]}>
              <TouchableOpacity
                style={[
                  styles.contentTypeSegmentBtn,
                  scheduleContentType === 'TEXT' && { backgroundColor: theme.tiktokRed },
                ]}
                onPress={() => setScheduleContentType('TEXT')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={14}
                  color={scheduleContentType === 'TEXT' ? '#FFFFFF' : theme.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.contentTypeSegmentText,
                    { color: scheduleContentType === 'TEXT' ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  Tin Nhắn Văn Bản
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.contentTypeSegmentBtn,
                  scheduleContentType === 'VIDEO' && { backgroundColor: theme.tiktokRed },
                ]}
                onPress={() => setScheduleContentType('VIDEO')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="videocam-outline"
                  size={14}
                  color={scheduleContentType === 'VIDEO' ? '#FFFFFF' : theme.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.contentTypeSegmentText,
                    { color: scheduleContentType === 'VIDEO' ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  Video Ngẫu Nhiên
                </Text>
              </TouchableOpacity>
            </View>

            {scheduleContentType === 'TEXT' ? (
              <>
                <View style={styles.labelWithAiRow}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>Nội dung tin nhắn hẹn gửi:</Text>
                  <TouchableOpacity
                    style={[
                      styles.aiSuggestBtn,
                      { backgroundColor: theme.surface },
                    ]}
                    onPress={handleGenerateAiForSchedule}
                    disabled={isGeneratingAiSchedule}
                    activeOpacity={0.7}
                  >
                    {isGeneratingAiSchedule ? (
                      <ActivityIndicator size="small" color={theme.tiktokRed} />
                    ) : (
                      <>
                        <Ionicons name="sparkles" size={12} color={theme.tiktokRed} style={{ marginRight: 4 }} />
                        <Text style={[styles.aiSuggestBtnText, { color: theme.tiktokRed }]}>Gemini AI gợi ý</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={[
                    styles.textArea,
                    {
                      backgroundColor: theme.inputBg,
                      color: theme.textPrimary,
                    },
                  ]}
                  multiline
                  numberOfLines={2}
                  value={scheduleMsg}
                  onChangeText={setScheduleMsg}
                  placeholder="Nhập nội dung cần hẹn giờ gửi..."
                  placeholderTextColor={theme.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Tự do nhập từ khóa tìm kiếm (Keyword):
                </Text>

                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.inputBg,
                      color: theme.textPrimary,
                    },
                  ]}
                  value={videoKeyword}
                  onChangeText={setVideoKeyword}
                  placeholder="Nhập từ khóa bất kỳ (VD: mèo béo, xe độ, review phim, nấu ăn...)"
                  placeholderTextColor={theme.textMuted}
                />

                <Text style={[styles.label, { color: theme.textMuted, fontSize: 11, marginTop: 8 }]}>
                  Gợi ý từ khóa mẫu (bấm để điền nhanh nếu muốn):
                </Text>

                {/* Quick keyword chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.keywordChipsScroll}>
                  {[
                    'hai huoc',
                    'thu cung',
                    'meme',
                    'gaming',
                    'am thuc',
                    'the thao',
                    'xe co',
                    'cong nghe',
                    'xu huong',
                  ].map((kw) => {
                    const isSelected = videoKeyword.toLowerCase() === kw.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={kw}
                        style={[
                          styles.keywordChip,
                          {
                            backgroundColor: isSelected ? theme.tiktokRed : theme.surface,
                            borderColor: isSelected ? theme.tiktokRed : theme.divider,
                          },
                        ]}
                        onPress={() => setVideoKeyword(kw)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.keywordChipText,
                            { color: isSelected ? '#FFFFFF' : theme.textPrimary },
                          ]}
                        >
                          {kw}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {/* Test preview video button */}
                <TouchableOpacity
                  style={[styles.testPreviewBtn, { backgroundColor: theme.surface }]}
                  onPress={handleTestPreviewVideo}
                  disabled={isPreviewingVideo}
                  activeOpacity={0.7}
                >
                  {isPreviewingVideo ? (
                    <ActivityIndicator size="small" color={theme.tiktokRed} />
                  ) : (
                    <>
                      <Ionicons name="search" size={14} color={theme.tiktokRed} />
                      <Text style={[styles.testPreviewBtnText, { color: theme.tiktokRed }]}>
                        Kiểm tra video mẫu theo từ khóa
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {previewVideoData && (
                  <View
                    style={[
                      styles.previewVideoCard,
                      { backgroundColor: theme.surface, borderColor: theme.divider },
                    ]}
                  >
                    <Text style={[styles.previewVideoTitle, { color: theme.textPrimary }]} numberOfLines={2}>
                      {previewVideoData.desc || 'Video TikTok'}
                    </Text>
                    <Text style={[styles.previewVideoAuthor, { color: theme.textSecondary }]}>
                      Kênh: {previewVideoData.authorNickname || 'TikTok Creator'} (@{previewVideoData.authorUniqueId})
                    </Text>
                    <Text style={[styles.previewVideoUrl, { color: theme.tiktokRed }]} numberOfLines={1}>
                      {previewVideoData.url}
                    </Text>
                  </View>
                )}

                <View style={[styles.keywordNoticeBox, { backgroundColor: theme.surface }]}>
                  <Text style={[styles.keywordNoticeText, { color: theme.textMuted }]}>
                    Đúng giờ hẹn, Worker sẽ tự động quét TikTok theo từ khóa trên, lấy ngẫu nhiên 1 video mới nhất và gửi qua tin nhắn để duy trì chuỗi lửa với bạn bè.
                  </Text>
                </View>
              </>
            )}

            {/* Quick time presets */}
            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>Chọn nhanh:</Text>
            <View style={styles.quickPresetRow}>
              {[1, 5, 15, 30, 60].map((mins) => (
                <TouchableOpacity
                  key={mins}
                  style={[styles.quickPresetBtn, { backgroundColor: theme.surface }]}
                  onPress={() => applyQuickTimePreset(mins)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.quickPresetText, { color: theme.textPrimary }]}>
                    +{mins >= 60 ? '1h' : `${mins}p`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Specific time input */}
            <Text style={[styles.label, { color: theme.textSecondary, marginTop: 10 }]}>
              Hẹn giờ chính xác (24h):
            </Text>
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputBox}>
                <Text style={[styles.timeInputSub, { color: theme.textMuted }]}>Giờ (0-23)</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  maxLength={2}
                  value={targetHour}
                  onChangeText={setTargetHour}
                  placeholder="23"
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              <Text style={[styles.timeColon, { color: theme.textPrimary }]}>:</Text>

              <View style={styles.timeInputBox}>
                <Text style={[styles.timeInputSub, { color: theme.textMuted }]}>Phút (0-59)</Text>
                <TextInput
                  style={[styles.timeInput, { backgroundColor: theme.inputBg, color: theme.textPrimary }]}
                  keyboardType="numeric"
                  maxLength={2}
                  value={targetMinute}
                  onChangeText={setTargetMinute}
                  placeholder="30"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            {/* Daily streak repeat option */}
            <View style={[styles.switchRow, { borderTopColor: theme.divider }]}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                    Lặp lại mỗi ngày (Giữ chuỗi)
                  </Text>
                  <Ionicons name="flame" size={15} color="#F97316" style={{ marginLeft: 4 }} />
                </View>
                <Text style={[styles.switchDesc, { color: theme.textMuted }]}>
                  Worker sẽ tự động gửi đúng vào giờ này mỗi ngày để duy trì chuỗi TikTok
                </Text>
              </View>
              <Switch
                value={repeatDaily}
                onValueChange={setRepeatDaily}
                trackColor={{ false: theme.surface, true: theme.tiktokRed }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Daily Gemini AI message rotation */}
            {repeatDaily && (
              <View style={[styles.switchRow, { borderTopColor: theme.divider, marginTop: 8 }]}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.switchTitle, { color: theme.textPrimary }]}>
                      Tự động đổi câu bằng Gemini AI
                    </Text>
                    <Ionicons name="sparkles" size={13} color={theme.tiktokRed} style={{ marginLeft: 4 }} />
                  </View>
                  <Text style={[styles.switchDesc, { color: theme.textMuted }]}>
                    Mỗi ngày đến giờ hẹn, Gemini AI sẽ tự động sinh 1 câu giữ chuỗi mới hài hước
                  </Text>
                </View>
                <Switch
                  value={useAiDaily}
                  onValueChange={setUseAiDaily}
                  trackColor={{ false: theme.surface, true: theme.tiktokRed }}
                  thumbColor="#FFFFFF"
                />
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.btnSchedule,
                { backgroundColor: isScheduling ? '#9CA3AF' : theme.tiktokRed },
              ]}
              onPress={handleCreateSchedule}
              disabled={isScheduling}
              activeOpacity={0.8}
            >
              {isScheduling ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="alarm" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.btnScheduleText}>
                {isScheduling ? 'Đang Thiết Lập Lịch...' : 'Lên Lịch Hẹn Ngay'}
              </Text>
            </TouchableOpacity>

            {/* Scheduled tasks for this conversation */}
            <View style={[styles.scheduleListHeader, { borderTopColor: theme.divider }]}>
              <Text style={[styles.scheduleListTitle, { color: theme.textPrimary }]}>
                Lịch Hẹn Của Cuộc Trò Chuyện Này ({scheduledTasks.length})
              </Text>
              {scheduledTasks.length > 0 && (
                <TouchableOpacity onPress={() => scheduleWorker.clearCompletedTasks()}>
                  <Text style={[styles.clearTasksText, { color: theme.textSecondary }]}>Dọn dẹp</Text>
                </TouchableOpacity>
              )}
            </View>

            {scheduledTasks.length === 0 ? (
              <Text style={[styles.emptyScheduleText, { color: theme.textMuted }]}>
                Chưa có lịch hẹn nào. Hãy chọn giờ và bấm 'Lên Lịch Hẹn Ngay'.
              </Text>
            ) : (
              scheduledTasks.map((task) => {
                const targetD = new Date(task.scheduledTime);
                const timeString = `${String(targetD.getHours()).padStart(2, '0')}:${String(targetD.getMinutes()).padStart(2, '0')}:${String(targetD.getSeconds()).padStart(2, '0')}`;
                const dateString = `${targetD.getDate()}/${targetD.getMonth() + 1}`;

                return (
                  <View
                    key={task.id}
                    style={[
                      styles.taskCard,
                      { backgroundColor: theme.surface },
                    ]}
                  >
                    <View style={styles.taskCardTop}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                          <Ionicons name="time-outline" size={14} color={theme.tiktokRed} style={{ marginRight: 4 }} />
                          <Text style={[styles.taskTime, { color: theme.textPrimary }]}>
                            Lúc {timeString} ({dateString})
                          </Text>
                          {task.repeatDaily ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>• Lặp lại </Text>
                              <Ionicons name="flame" size={13} color="#F97316" />
                            </View>
                          ) : null}
                          {task.sendVideoMode ? (
                            <View style={styles.videoBadgeTag}>
                              <Ionicons name="videocam" size={11} color="#000000" style={{ marginRight: 3 }} />
                              <Text style={styles.videoBadgeTagText}>VIDEO: {task.videoKeyword || 'Hai huoc'}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={[styles.taskMsg, { color: theme.textSecondary }]} numberOfLines={2}>
                          {task.sendVideoMode
                            ? (task.sentVideoUrl
                                ? `Đã gửi: "${task.sentVideoTitle || 'Video'}" (${task.sentVideoUrl})`
                                : `Tự động tìm & gửi video theo từ khóa: "${task.videoKeyword || 'Hai huoc'}"`)
                            : `"${task.messageText}"`}
                        </Text>
                      </View>

                      {task.status === 'PENDING' ? (
                        <TouchableOpacity
                          style={styles.cancelTaskBtn}
                          onPress={() => scheduleWorker.cancelTask(task.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="close-circle-outline" size={20} color={theme.tiktokRed} />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.cancelTaskBtn}
                          onPress={() => scheduleWorker.deleteTask(task.id)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="trash-outline" size={17} color={theme.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Status and live countdown timer */}
                    <View style={styles.taskCardBottom}>
                      {task.status === 'PENDING' ? (
                        <View style={styles.countdownBadge}>
                          <Ionicons name="timer-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                          <Text style={styles.countdownText}>
                            Còn lại: {formatCountdown(task.scheduledTime)}
                          </Text>
                        </View>
                      ) : task.status === 'SENDING' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="paper-plane" size={13} color={theme.tiktokRed} style={{ marginRight: 4 }} />
                          <Text style={{ color: theme.tiktokRed, fontSize: 12, fontWeight: '700' }}>
                            Worker đang tiến hành gửi...
                          </Text>
                        </View>
                      ) : task.status === 'SUCCESS' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="checkmark-circle" size={13} color="#22C55E" style={{ marginRight: 4 }} />
                          <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                            {task.resultMsg}
                          </Text>
                        </View>
                      ) : task.status === 'CANCELLED' ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="close-circle" size={13} color={theme.textMuted} style={{ marginRight: 4 }} />
                          <Text style={{ color: theme.textMuted, fontSize: 12, marginLeft: 4 }}>
                            Đã hủy lịch hẹn
                          </Text>
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="alert-circle" size={13} color={theme.tiktokRed} style={{ marginRight: 4 }} />
                          <Text style={{ color: theme.tiktokRed, fontSize: 12, fontWeight: '600', marginLeft: 4 }}>
                            {task.resultMsg}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Auto-run progress bar */}
        {isRunning && (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="hourglass-outline" size={16} color={theme.tiktokRed} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                Tiến Trình: {progress.current}/{progress.total}
              </Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: theme.surface }]}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    backgroundColor: theme.tiktokRed,
                    width: `${Math.round((progress.current / (progress.total || 1)) * 100)}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.progressStatRow}>
              <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>
                Thành công: {progress.success}
              </Text>
              <Text style={{ color: theme.tiktokRed, fontSize: 12, fontWeight: '600' }}>
                Thất bại: {progress.failed}
              </Text>
            </View>
          </View>
        )}

        {/* Live log terminal */}
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="terminal-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Nhật Ký Hoạt Động (Live Log)</Text>
            </View>
            <TouchableOpacity onPress={() => setLogs([])}>
              <Text style={[styles.clearLogText, { color: theme.textSecondary }]}>Xóa log</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.logTerminal, { backgroundColor: isDarkMode ? '#0B0C0E' : '#F4F4F6' }]}>
            <ScrollView ref={logScrollRef} style={styles.logScroll} nestedScrollEnabled>
              {logs.length === 0 ? (
                <Text style={[styles.emptyLogText, { color: theme.textMuted }]}>
                  Chưa có hoạt động nào. Hãy bấm 'Gửi Thử', 'Bắt Đầu' hoặc hẹn giờ gửi.
                </Text>
              ) : (
                logs.map((log, index) => {
                  let logColor = theme.textSecondary;
                  if (log.type === 'success') logColor = '#22C55E';
                  if (log.type === 'error') logColor = theme.tiktokRed;
                  if (log.type === 'warning') logColor = '#F59E0B';
                  if (log.type === 'muted') logColor = theme.textMuted;

                  return (
                    <Text key={index} style={[styles.logLine, { color: logColor }]}>
                      <Text style={{ color: theme.textMuted }}>[{log.time}] </Text>
                      {log.text}
                    </Text>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarInitial: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerUserText: {
    flex: 1,
  },
  headerNickname: {
    fontSize: 15,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  scrollArea: {
    flex: 1,
    padding: 14,
  },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  lastMsgText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  cidText: {
    fontSize: 11,
    marginTop: 6,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 4,
  },
  textArea: {
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  inputGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  gridCol: {
    flex: 1,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  safeModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  safeModeBannerText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  btnSingle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
  },
  btnSingleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  btnStart: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    elevation: 3,
    shadowColor: '#FE2C55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  btnStartText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  quickPresetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  quickPresetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  quickPresetText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 6,
  },
  timeInputBox: {
    width: 76,
  },
  timeInputSub: {
    fontSize: 10,
    marginBottom: 3,
  },
  timeInput: {
    borderRadius: 10,
    height: 42,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  timeColon: {
    fontSize: 22,
    fontWeight: 'bold',
    marginHorizontal: 10,
    marginTop: 14,
  },
  btnSchedule: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 22,
    marginTop: 16,
    elevation: 3,
    shadowColor: '#FE2C55',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
  btnScheduleText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  scheduleListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scheduleListTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  clearTasksText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyScheduleText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  taskCard: {
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  taskCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  taskTime: {
    fontSize: 13,
    fontWeight: '700',
  },
  taskMsg: {
    fontSize: 12,
    marginTop: 3,
    fontStyle: 'italic',
  },
  cancelTaskBtn: {
    padding: 2,
  },
  taskCardBottom: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  countdownBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE2C55',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countdownText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  clearLogText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logTerminal: {
    height: 140,
    borderRadius: 10,
    padding: 10,
    marginTop: 4,
  },
  logScroll: {
    flex: 1,
  },
  emptyLogText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  logLine: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 3,
  },
  labelWithAiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  aiSuggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  aiSuggestBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contentTypeSegmentRow: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 10,
    overflow: 'hidden',
    padding: 3,
  },
  contentTypeSegmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  contentTypeSegmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  keywordChipsScroll: {
    marginVertical: 8,
  },
  keywordChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1,
  },
  keywordChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  testPreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  testPreviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  previewVideoCard: {
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
  },
  previewVideoTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  previewVideoAuthor: {
    fontSize: 11,
    marginBottom: 2,
  },
  previewVideoUrl: {
    fontSize: 10,
    fontFamily: 'monospace',
  },
  videoBadgeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  videoBadgeTagText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '700',
  },
  keywordNoticeBox: {
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  keywordNoticeText: {
    fontSize: 11,
    lineHeight: 16,
  },
});
