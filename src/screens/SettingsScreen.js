import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
  Switch,
  Platform,
  ToastAndroid,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../constants/ThemeContext';
import { debugLogger } from '../services/debugLoggerService';
import {
  getGeminiApiKey,
  saveGeminiApiKey,
  getGeminiStreakStyle,
  saveGeminiStreakStyle,
  getActiveGeminiModel,
  testGeminiApiKey,
  generateStreakMessageWithGemini,
} from '../services/geminiService';
import { fetchCurrentAccountProfile } from '../services/tiktokApi';
import { clearConversationCache } from './ConversationListScreen';
import { nativeBackgroundService } from '../services/nativeBackgroundService';
import { scheduleWorker } from '../services/scheduleWorker';
import DangerSecurityModal from '../components/DangerSecurityModal';

let cachedCurrentProfile = null;
const CACHED_PROFILE_KEY = 'TIKTOK_CACHED_MY_PROFILE_V2';

export default function SettingsScreen({ cookieStr = '', onBack, onLogout }) {
  const { theme, isDarkMode, themeMode, setThemeMode, toggleTheme } = useTheme();

  // Điều hướng sub-view: 'MAIN' | 'GEMINI' | 'ACCOUNT_DETAIL'
  const [currentView, setCurrentView] = useState('MAIN');

  // Thông tin profile tài khoản hiện tại (nạp ngay từ cache nếu có)
  const [profile, setProfile] = useState(cachedCurrentProfile);
  const [loadingProfile, setLoadingProfile] = useState(!cachedCurrentProfile);

  // Trạng thái dịch vụ chạy ngầm & Tối ưu pin
  const [bgServiceEnabled, setBgServiceEnabled] = useState(scheduleWorker.isBgServiceEnabled);
  const [isIgnoringBattery, setIsIgnoringBattery] = useState(true);
  const [unlockedMode, setUnlockedMode] = useState(false);
  const [showDangerModal, setShowDangerModal] = useState(false);

  // Trạng thái cấu hình Gemini AI
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('FUNNY');
  const [activeModel, setActiveModel] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isGeneratingSample, setIsGeneratingSample] = useState(false);
  const [sampleMessage, setSampleMessage] = useState('');
  const [sampleSource, setSampleSource] = useState(null);

  // Dev Mode & Debug Logs
  const [isDevMode, setIsDevMode] = useState(debugLogger.isDevModeEnabled());
  const [devLogs, setDevLogs] = useState(debugLogger.getLogs());
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  // Lắng nghe trạng thái Dev Mode và Logs realtime
  useEffect(() => {
    const unsub = debugLogger.subscribe((enabled, logs) => {
      setIsDevMode(enabled);
      setDevLogs(logs);
    });
    return () => unsub();
  }, []);

  // Xử lý Easter Egg: Nhấn nhanh liên tục 10 lần vào chữ "Cài đặt" để kích hoạt Dev Mode
  const handleHeaderTitleTap = async () => {
    const now = Date.now();
    let count = 1;
    if (now - lastTapTime < 1500) {
      count = devTapCount + 1;
    }
    setLastTapTime(now);
    setDevTapCount(count);

    if (count >= 10) {
      setDevTapCount(0);
      const nextState = !isDevMode;
      await debugLogger.setDevMode(nextState);
      setIsDevMode(nextState);
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          nextState
            ? 'BAN DA TRO THANH NHA PHAT TRIEN (DEV MODE ON)!'
            : 'Da tat Che do Nha phat trien.',
          ToastAndroid.LONG
        );
      } else {
        Alert.alert(
          'Che Do Nha Phat Trien',
          nextState ? 'Da bat Che do Dev Mode!' : 'Da tat Che do Dev Mode.'
        );
      }
    } else if (count >= 5) {
      const remaining = 10 - count;
      if (Platform.OS === 'android') {
        ToastAndroid.show(`Còn ${remaining} bước nữa để mở Dev Mode!`, ToastAndroid.SHORT);
      }
    }
  };

  const handleCopyAllLogs = async () => {
    if (devLogs.length === 0) {
      if (Platform.OS === 'android') ToastAndroid.show('Chưa có log.', ToastAndroid.SHORT);
      return;
    }
    const text = devLogs
      .map(
        (l) =>
          `[${l.timestamp}][${l.module}][${l.level.toUpperCase()}] ${l.message}${
            l.details ? '\n' + l.details : ''
          }`
      )
      .join('\n');
    await nativeBackgroundService.setClipboardText(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Đã sao chép toàn bộ nhật ký hệ thống!', ToastAndroid.SHORT);
    } else {
      Alert.alert('Thành công', 'Đã sao chép toàn bộ nhật ký hệ thống.');
    }
  };

  // Tải thông tin tài khoản và cấu hình đã lưu
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      // 0. Nạp profile từ bộ nhớ đệm nếu chưa có trong RAM
      if (!cachedCurrentProfile) {
        try {
          const stored = await AsyncStorage.getItem(CACHED_PROFILE_KEY);
          if (stored && isMounted) {
            const parsed = JSON.parse(stored);
            cachedCurrentProfile = parsed;
            setProfile(parsed);
          }
        } catch (_) {}
      }

      // 1. Tải cấu hình Gemini
      const savedKey = await getGeminiApiKey();
      const savedStyle = await getGeminiStreakStyle();
      const savedModel = await getActiveGeminiModel();
      if (isMounted) {
        setApiKey(savedKey);
        setSelectedStyle(savedStyle);
        setActiveModel(savedModel);
      }

      // 2. Tải Profile của tài khoản hiện tại từ API chính thức
      if (cookieStr) {
        if (!cachedCurrentProfile) setLoadingProfile(true);
        try {
          const prof = await fetchCurrentAccountProfile(cookieStr);
          if (isMounted && prof) {
            cachedCurrentProfile = prof;
            setProfile(prof);
            AsyncStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(prof)).catch(() => {});
          }
        } catch (e) {
          console.warn('Lỗi tải profile tài khoản hiện tại:', e);
        } finally {
          if (isMounted) setLoadingProfile(false);
        }
      } else {
        if (isMounted) setLoadingProfile(false);
      }

      // 3. Kiểm tra trạng thái chạy ngầm và tối ưu pin
      nativeBackgroundService.isIgnoringBatteryOptimizations().then((val) => {
        if (isMounted) setIsIgnoringBattery(val);
      });
      if (isMounted) setBgServiceEnabled(scheduleWorker.isBgServiceEnabled);

      // 4. Kiểm tra chế độ mở khóa tốc độ
      AsyncStorage.getItem('TIKTOKTOE_UNLOCKED_SPEED_MODE').then((val) => {
        if (isMounted) setUnlockedMode(val === 'true');
      });
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [cookieStr]);

  // Bật/tắt dịch vụ chạy ngầm
  const handleToggleBgService = async (val) => {
    setBgServiceEnabled(val);
    await scheduleWorker.setBackgroundServiceEnabled(val);
  };

  // Mở cài đặt tối ưu hóa pin hệ thống
  const handleRequestBatteryOpt = async () => {
    await nativeBackgroundService.requestIgnoreBatteryOptimizations();
    setTimeout(() => {
      nativeBackgroundService.isIgnoringBatteryOptimizations().then(setIsIgnoringBattery);
    }, 2000);
  };

  // Bật/tắt chế độ mở khóa giới hạn tốc độ (kèm modal Danger chuẩn MIUI)
  const handleToggleUnlockedMode = (val) => {
    if (val) {
      setShowDangerModal(true);
    } else {
      setUnlockedMode(false);
      AsyncStorage.setItem('TIKTOKTOE_UNLOCKED_SPEED_MODE', 'false').catch(() => {});
      Alert.alert('Thông báo', 'Đã kích hoạt lại Chế độ an toàn (Safe Mode) cho tài khoản.');
    }
  };

  const handleConfirmDangerUnlock = () => {
    setShowDangerModal(false);
    setUnlockedMode(true);
    AsyncStorage.setItem('TIKTOKTOE_UNLOCKED_SPEED_MODE', 'true').catch(() => {});
  };

  const handleCancelDangerUnlock = () => {
    setShowDangerModal(false);
  };

  // Lưu API Key
  const handleSaveKey = async () => {
    const trimmed = apiKey.trim();
    const success = await saveGeminiApiKey(trimmed);
    if (success) {
      setTestResult(null);
      Alert.alert('Thành công', 'Đã lưu Gemini API Key vào máy!');
    } else {
      Alert.alert('Lỗi', 'Không thể lưu cài đặt.');
    }
  };

  // Kiểm tra kết nối API Key
  const handleTestKey = async () => {
    if (!apiKey.trim()) {
      Alert.alert('Thông báo', 'Vui lòng nhập API Key trước khi kiểm tra!');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    const res = await testGeminiApiKey(apiKey.trim());
    setIsTesting(false);

    if (res.success) {
      setActiveModel(res.model);
      setTestResult({
        success: true,
        message: `Kết nối thành công với mô hình ${res.model}!`,
      });
      await saveGeminiApiKey(apiKey.trim());
    } else {
      setTestResult({
        success: false,
        message: res.error || 'Kiểm tra thất bại. Vui lòng kiểm tra lại Key!',
      });
    }
  };

  // Chọn phong cách giữ chuỗi
  const handleSelectStyle = async (styleKey) => {
    setSelectedStyle(styleKey);
    await saveGeminiStreakStyle(styleKey);
  };

  // Thử sinh 1 câu mẫu
  const handleGenerateSample = async () => {
    setIsGeneratingSample(true);
    const targetName = profile?.nickname || 'bạn';
    const res = await generateStreakMessageWithGemini(apiKey.trim(), selectedStyle, targetName);
    setIsGeneratingSample(false);
    setSampleMessage(res.text);
    setSampleSource({ source: res.source, model: res.model });
  };

  // Xử lý xác nhận đổi tài khoản
  const handleSwitchAccount = () => {
    const usernameDisplay = profile?.unique_id ? `@${profile.unique_id}` : 'tài khoản hiện tại';
    Alert.alert(
      'Đổi Tài Khoản',
      `Bạn có muốn đăng xuất khỏi ${usernameDisplay} để đăng nhập tài khoản TikTok khác không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đổi Tài Khoản',
          style: 'destructive',
          onPress: () => {
            cachedCurrentProfile = null;
            AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
            if (onLogout) onLogout();
          },
        },
      ]
    );
  };

  // Đăng xuất hoàn toàn
  const handleLogout = () => {
    Alert.alert(
      'Đăng Xuất',
      'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng và xóa phiên lưu trên thiết bị không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Đăng Xuất',
          style: 'destructive',
          onPress: () => {
            cachedCurrentProfile = null;
            AsyncStorage.removeItem(CACHED_PROFILE_KEY).catch(() => {});
            if (onLogout) onLogout();
          },
        },
      ]
    );
  };

  // Xóa bộ nhớ đệm
  const handleClearCache = () => {
    clearConversationCache();
    Alert.alert('Bộ Nhớ Đệm', 'Đã xóa bộ nhớ đệm danh sách tin nhắn thành công.');
  };

  const styleOptions = [
    { key: 'FUNNY', label: 'Hài hước Gen Z', icon: 'happy-outline' },
    { key: 'TRENDING', label: 'Bắt Trend TikTok', icon: 'trending-up-outline' },
    { key: 'CUTE', label: 'Đáng yêu & Quan tâm', icon: 'heart-outline' },
    { key: 'COOL', label: 'Ngắn gọn & Ngầu', icon: 'flash-outline' },
  ];

  /* =====================================================================
   * SUB-VIEW 1: CÀI ĐẶT RIÊNG CHO GEMINI AI
   * ===================================================================== */
  if (currentView === 'GEMINI') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Header chi tiết Gemini */}
        <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setCurrentView('MAIN')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Cài Đặt Gemini AI</Text>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.contentArea} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          {/* Card Mục Gemini AI */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.aiIconBadge, { backgroundColor: theme.surface }]}>
                <Ionicons name="sparkles" size={20} color={theme.textPrimary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Google Gemini AI</Text>
                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                  Tự động sáng tạo câu giữ chuỗi streak độc đáo, ngắn gọn và hài hước
                </Text>
              </View>
            </View>

            {/* Ô Nhập Dán API Key */}
            <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
              Gemini API Key (Google AI Studio)
            </Text>

            <View style={[styles.inputRow, { backgroundColor: theme.inputBg }]}>
              <Ionicons name="key-outline" size={18} color={theme.textPrimary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.apiKeyInput, { color: theme.textPrimary }]}
                placeholder="Dán API Key tại đây (AIzaSy...)"
                placeholderTextColor={theme.textMuted}
                value={apiKey}
                onChangeText={setApiKey}
                secureTextEntry={!showKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowKey(!showKey)} style={styles.eyeBtn}>
                <Ionicons
                  name={showKey ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            {/* Hàng nút bấm: Lưu & Test Key */}
            <View style={styles.actionBtnRow}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: theme.tiktokRed }]}
                onPress={handleSaveKey}
                activeOpacity={0.8}
              >
                <Ionicons name="save-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Lưu Key</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.testBtn,
                  { backgroundColor: theme.surface },
                ]}
                onPress={handleTestKey}
                disabled={isTesting}
                activeOpacity={0.7}
              >
                {isTesting ? (
                  <ActivityIndicator size="small" color={theme.tiktokRed} />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={15} color={theme.textPrimary} style={{ marginRight: 6 }} />
                    <Text style={[styles.testBtnText, { color: theme.textPrimary }]}>Kiểm Tra Kết Nối</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Thông báo kết quả kiểm tra API Key */}
            {testResult && (
              <View
                style={[
                  styles.testResultBanner,
                  {
                    backgroundColor: testResult.success
                      ? isDarkMode
                        ? 'rgba(16, 185, 129, 0.15)'
                        : '#ECFDF5'
                      : isDarkMode
                      ? 'rgba(239, 68, 68, 0.15)'
                      : '#FEF2F2',
                  },
                ]}
              >
                <Ionicons
                  name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={testResult.success ? '#10B981' : '#EF4444'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.testResultText,
                    { color: testResult.success ? '#059669' : '#DC2626' },
                  ]}
                >
                  {testResult.message}
                </Text>
              </View>
            )}

            {/* Hộp thông tin model đang hoạt động */}
            {activeModel ? (
              <View
                style={[
                  styles.activeModelBox,
                  {
                    backgroundColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="hardware-chip-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.activeModelLabel, { color: theme.textSecondary }]}>Mô hình AI đang dùng:</Text>
                  <Text style={[styles.activeModelValue, { color: theme.textPrimary }]}> {activeModel}</Text>
                </View>
                {activeModel.toLowerCase().includes('gemma') ? (
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 6 }}>
                    <Ionicons name="information-circle-outline" size={14} color={theme.textSecondary} style={{ marginRight: 4, marginTop: 1 }} />
                    <Text style={[styles.activeModelDesc, { color: theme.textMuted }]}>
                      Gemma là mô hình AI mã nguồn mở cao cấp của Google DeepMind. Do tài khoản Google của bạn đang tạm hết hạn mức (quota) Gemini chính, hệ thống tự động kết nối sang Gemma để bạn vẫn dùng giữ chuỗi được bình thường không bị lỗi.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Hướng dẫn lấy API Key */}
            <View style={[styles.tipBox, { backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC' }]}>
              <Ionicons name="information-circle-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.tipText, { color: theme.textSecondary }]}>
                Bạn có thể lấy Gemini API Key miễn phí tại Google AI Studio:{' '}
                <Text style={{ color: theme.textPrimary, fontWeight: '700' }}>aistudio.google.com</Text>
              </Text>
            </View>
          </View>

          {/* Card Lựa Chọn Phong Cách Câu Nói / Quote */}
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 4 }]}>
              Phong Cách Câu Nói / Quote Vu Vơ
            </Text>
            <Text style={[styles.cardSub, { color: theme.textSecondary, marginBottom: 12 }]}>
              Chọn ngữ điệu để Gemini sáng tạo câu nói phù hợp nhất
            </Text>

            <View style={styles.styleOptionsContainer}>
              {styleOptions.map((opt) => {
                const isSelected = selectedStyle === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.styleChip,
                      {
                        backgroundColor: isSelected ? theme.tiktokRed : theme.surface,
                      },
                    ]}
                    onPress={() => handleSelectStyle(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={15}
                      color={isSelected ? '#FFFFFF' : theme.textSecondary}
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.styleChipText,
                        { color: isSelected ? '#FFFFFF' : theme.textSecondary, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Nút Thử Sinh Câu Mẫu Ngay */}
            <TouchableOpacity
              style={[styles.sampleBtn, { backgroundColor: theme.surface }]}
              onPress={handleGenerateSample}
              disabled={isGeneratingSample}
              activeOpacity={0.7}
            >
              {isGeneratingSample ? (
                <ActivityIndicator size="small" color={theme.textPrimary} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={15} color={theme.textPrimary} style={{ marginRight: 6 }} />
                  <Text style={[styles.sampleBtnText, { color: theme.textPrimary }]}>
                    Thử Tạo Câu Quote Vu Vơ
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* Khung hiển thị câu mẫu */}
            {sampleMessage ? (
              <View style={[styles.sampleResultBox, { backgroundColor: theme.surface }]}>
                <View style={styles.sampleResultHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Ionicons name="chatbubble-ellipses-outline" size={14} color={theme.textPrimary} style={{ marginRight: 4 }} />
                    <Text style={[styles.sampleResultLabel, { color: theme.textSecondary }]}>Câu quote vừa tạo:</Text>
                  </View>
                  {sampleSource && (
                    <View
                      style={[
                        styles.sampleSourceBadge,
                        {
                          backgroundColor:
                            sampleSource.source === 'GEMINI'
                              ? isDarkMode
                                ? 'rgba(16, 185, 129, 0.2)'
                                : '#D1FAE5'
                              : isDarkMode
                              ? 'rgba(245, 158, 11, 0.2)'
                              : '#FEF3C7',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sampleSourceText,
                          {
                            color: sampleSource.source === 'GEMINI' ? '#059669' : '#D97706',
                          },
                        ]}
                      >
                        {sampleSource.source === 'GEMINI'
                          ? sampleSource.model || 'AI'
                          : 'Dự phòng'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.sampleResultText, { color: theme.textPrimary }]}>
                  "{sampleMessage}"
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =====================================================================
   * SUB-VIEW 2: CHI TIẾT TÀI KHOẢN TIKTOK
   * ===================================================================== */
  if (currentView === 'ACCOUNT_DETAIL') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setCurrentView('MAIN')}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Thông Tin Tài Khoản</Text>

          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={styles.contentArea} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={[styles.card, { backgroundColor: theme.card, alignItems: 'center', paddingVertical: 24 }]}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.largeAvatar} />
            ) : (
              <View style={[styles.largeAvatarPlaceholder, { backgroundColor: theme.surface }]}>
                <Ionicons name="person" size={40} color={theme.iconMuted} />
              </View>
            )}

            <Text style={[styles.profileCardName, { color: theme.textPrimary, marginTop: 12 }]}>
              {profile?.nickname || 'Người dùng TikTok'}
            </Text>

            <Text style={[styles.profileCardUsername, { color: theme.textSecondary }]}>
              @{profile?.unique_id || 'tiktok_user'}
            </Text>

            {profile?.signature ? (
              <Text style={[styles.profileBioText, { color: theme.textMuted }]}>
                "{profile.signature}"
              </Text>
            ) : null}
          </View>

          {/* Chi tiết tài khoản */}
          <Text style={[styles.sectionHeaderTitle, { color: theme.textMuted }]}>CHI TIẾT TÀI KHOẢN</Text>
          <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
            <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>TikTok User ID (UID)</Text>
              <Text style={[styles.detailValue, { color: theme.textPrimary }]} selectable>
                {profile?.uid || 'Chưa xác định'}
              </Text>
            </View>

            <View style={[styles.detailRow, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Tên người dùng (@)</Text>
              <Text style={[styles.detailValue, { color: theme.textPrimary }]} selectable>
                @{profile?.unique_id || 'Chưa có'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textSecondary }]}>Biệt danh hiển thị</Text>
              <Text style={[styles.detailValue, { color: theme.textPrimary }]}>
                {profile?.nickname || 'Người dùng'}
              </Text>
            </View>
          </View>

          {/* Nút đổi tài khoản */}
          <TouchableOpacity
            style={[styles.switchAccountBtn, { backgroundColor: '#F59E0B' }]}
            onPress={handleSwitchAccount}
            activeOpacity={0.8}
          >
            <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={[styles.switchAccountBtnText, { color: '#FFFFFF' }]}>Đổi Sang Tài Khoản Khác</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* =====================================================================
   * SUB-VIEW 0: MENU CÀI ĐẶT CHÍNH CHUẨN TIKTOK (MAIN SETTINGS)
   * ===================================================================== */
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header chuẩn: Cài đặt */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleHeaderTitleTap}
          activeOpacity={0.8}
          style={styles.headerTitleWrapper}
        >
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Cài đặt</Text>
          {isDevMode && (
            <View style={styles.devModeHeaderBadge}>
              <Text style={styles.devModeHeaderBadgeText}>DEV</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.themeToggleBtn, { backgroundColor: theme.surface }]}
          onPress={toggleTheme}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isDarkMode ? 'sunny-outline' : 'moon'}
            size={17}
            color={isDarkMode ? '#F59E0B' : '#8B5CF6'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentArea} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* CARD PROFILE TÀI KHOẢN HIỆN TẠI (Đầu trang Settings) */}
        <TouchableOpacity
          style={[styles.profileCard, { backgroundColor: theme.card }]}
          onPress={() => setCurrentView('ACCOUNT_DETAIL')}
          activeOpacity={0.7}
        >
          {loadingProfile ? (
            <View style={styles.profileLoadingRow}>
              <ActivityIndicator size="small" color={theme.tiktokRed} />
              <Text style={[styles.profileLoadingText, { color: theme.textSecondary }]}>
                Đang xác thực thông tin tài khoản...
              </Text>
            </View>
          ) : (
            <View style={styles.profileRow}>
              {profile?.avatar ? (
                <Image source={{ uri: profile.avatar }} style={styles.profileAvatar} />
              ) : (
                <View style={[styles.profileAvatarPlaceholder, { backgroundColor: theme.surface }]}>
                  <Ionicons name="person" size={26} color={theme.textPrimary} />
                </View>
              )}

              <View style={styles.profileInfoCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.profileName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {profile?.nickname || 'Tài khoản TikTok'}
                  </Text>
                </View>

                <Text style={[styles.profileUsername, { color: theme.textSecondary }]} numberOfLines={1}>
                  {profile?.unique_id ? `@${profile.unique_id}` : (profile?.uid ? `UID: ${profile.uid}` : '@chua_dang_nhap')}
                </Text>

                {profile?.uid ? (
                  <Text style={[styles.profileUid, { color: theme.textMuted }]}>
                    ID: {profile.uid}
                  </Text>
                ) : null}
              </View>

              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </View>
          )}
        </TouchableOpacity>

        {/* ================================================================= */}
        {/* MỤC 1: AI & TỰ ĐỘNG HÓA (CHỈ GIỮ MỤC GEMINI AI) */}
        {/* ================================================================= */}
        <Text style={[styles.sectionHeaderTitle, { color: theme.textMuted }]}>AI & TỰ ĐỘNG HÓA</Text>
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          {/* Dòng Google Gemini AI */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={() => setCurrentView('GEMINI')}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIconBox, { backgroundColor: theme.surface }]}>
              <Ionicons name="sparkles-outline" size={18} color={theme.textPrimary} />
            </View>
            <View style={styles.rowContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Google Gemini AI</Text>
                {apiKey ? (
                  <View style={[styles.chipBadge, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.chipBadgeText, { color: theme.textSecondary }]}>Đã kết nối</Text>
                  </View>
                ) : (
                  <View style={[styles.chipBadge, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.chipBadgeText, { color: theme.textMuted }]}>Chưa nhập Key</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Cấu hình API Key, phong cách tạo câu tự động giữ chuỗi
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* MỤC 2: TIẾN TRÌNH NỀN & TỰ ĐỘNG GIỮ CHUỖI (BACKGROUND SERVICE) */}
        {/* ================================================================= */}
        <Text style={[styles.sectionHeaderTitle, { color: theme.textMuted }]}>TIẾN TRÌNH NỀN & TỰ ĐỘNG GIỮ CHUỖI</Text>
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          {/* Switch Bật/Tắt Dịch Vụ Nền Tự Động */}
          <View style={[styles.settingsRow, { borderBottomColor: theme.divider }]}>
            <View style={[styles.rowIconBox, { backgroundColor: theme.surface }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#10B981" />
            </View>
            <View style={styles.rowContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Dịch vụ nền tự động</Text>
                {bgServiceEnabled ? (
                  <View style={[styles.chipBadge, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5' }]}>
                    <Text style={[styles.chipBadgeText, { color: '#10B981', fontWeight: '700' }]}>Đang bảo vệ</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Giữ tiến trình gửi tin nhắn đúng giờ kể cả khi vuốt đóng app
              </Text>
            </View>
            <Switch
              value={bgServiceEnabled}
              onValueChange={handleToggleBgService}
              trackColor={{ false: theme.surface, true: theme.tiktokRed }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Quyền miễn trừ Tối ưu Pin */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={handleRequestBatteryOpt}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIconBox, { backgroundColor: theme.surface }]}>
              <Ionicons name="battery-charging-outline" size={18} color={theme.textPrimary} />
            </View>
            <View style={styles.rowContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Tối ưu hóa pin hệ thống</Text>
                {isIgnoringBattery ? (
                  <View style={[styles.chipBadge, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5' }]}>
                    <Text style={[styles.chipBadgeText, { color: '#10B981', fontWeight: '700' }]}>Không hạn chế</Text>
                  </View>
                ) : (
                  <View style={[styles.chipBadge, { backgroundColor: theme.surface }]}>
                    <Text style={[styles.chipBadgeText, { color: theme.textMuted }]}>Cần cấp phép</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Cho phép gửi tin nhắn khi tắt màn hình / chế độ Doze Mode
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* MỤC: AN TOÀN & GIỚI HẠN TỐC ĐỘ */}
        {/* ================================================================= */}
        <Text style={[styles.sectionHeaderTitle, { color: theme.textMuted }]}>AN TOÀN & GIỚI HẠN TỐC ĐỘ</Text>
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          <View style={styles.settingsRow}>
            <View
              style={[
                styles.rowIconBox,
                {
                  backgroundColor: unlockedMode
                    ? isDarkMode
                      ? 'rgba(239, 68, 68, 0.15)'
                      : '#FEE2E2'
                    : isDarkMode
                    ? 'rgba(16, 185, 129, 0.15)'
                    : '#ECFDF5',
                },
              ]}
            >
              <Ionicons
                name={unlockedMode ? 'speedometer' : 'shield-checkmark-outline'}
                size={18}
                color={unlockedMode ? '#EF4444' : '#10B981'}
              />
            </View>
            <View style={styles.rowContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Mở khóa giới hạn tốc độ</Text>
                <View
                  style={[
                    styles.chipBadge,
                    {
                      backgroundColor: unlockedMode
                        ? '#EF4444'
                        : isDarkMode
                        ? 'rgba(16, 185, 129, 0.16)'
                        : '#ECFDF5',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      { color: unlockedMode ? '#FFFFFF' : '#10B981', fontWeight: '700' },
                    ]}
                  >
                    {unlockedMode ? 'Đã mở khóa' : 'Safe Mode'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                {unlockedMode
                  ? 'Cho phép gửi tốc độ cao không giới hạn (Có nguy cơ bị TikTok khóa nick)'
                  : 'Mặc định giới hạn tối đa 5 tin và trễ tối thiểu 5s để bảo vệ tài khoản'}
              </Text>
            </View>
            <Switch
              value={unlockedMode}
              onValueChange={handleToggleUnlockedMode}
              trackColor={{ false: theme.surface, true: theme.tiktokRed }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ================================================================= */}
        {/* MỤC 3: GIAO DIỆN & HỆ THỐNG */}
        {/* ================================================================= */}
        <Text style={[styles.sectionHeaderTitle, { color: theme.textMuted }]}>GIAO DIỆN & HỆ THỐNG</Text>
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          {/* Tùy chọn giao diện: Theo hệ thống / Tối / Sáng */}
          <View style={[styles.settingsRow, { borderBottomColor: theme.divider, flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              <View style={[styles.rowIconBox, { backgroundColor: theme.surface }]}>
                <Ionicons name="color-palette-outline" size={18} color={theme.textPrimary} />
              </View>
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Chế độ giao diện</Text>
                <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                  {themeMode === 'SYSTEM' ? 'Tự động theo điện thoại' : themeMode === 'DARK' ? 'Giao diện tối (Nền đen TikTok)' : 'Giao diện sáng'}
                </Text>
              </View>
            </View>

            {/* Cụm 3 nút chọn theme */}
            <View style={styles.themeSelectorRow}>
              {[
                { key: 'SYSTEM', label: 'Hệ thống', icon: 'phone-portrait-outline', iconColor: theme.textSecondary },
                { key: 'DARK', label: 'Tối', icon: 'moon', iconColor: '#8B5CF6' },
                { key: 'LIGHT', label: 'Sáng', icon: 'sunny', iconColor: '#F59E0B' },
              ].map((item) => {
                const isSelected = themeMode === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[
                      styles.themeOptionBtn,
                      {
                        backgroundColor: isSelected ? theme.tiktokRed : theme.surface,
                      },
                    ]}
                    onPress={() => setThemeMode(item.key)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={item.icon}
                      size={15}
                      color={
                        isSelected
                          ? '#FFFFFF'
                          : item.iconColor
                      }
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.themeOptionText,
                        {
                          color: isSelected ? '#FFFFFF' : theme.textSecondary,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Xóa Cache */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIconBox, { backgroundColor: theme.surface }]}>
              <Ionicons name="trash-outline" size={18} color={theme.textPrimary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Xóa bộ nhớ đệm</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Làm mới và tải lại danh sách tin nhắn từ TikTok
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* MỤC 4: TÀI KHOẢN & ĐĂNG NHẬP (DƯỚI CÙNG THEO YÊU CẦU) */}
        {/* ================================================================= */}
        <Text style={[styles.sectionHeaderTitle, { color: theme.textMuted }]}>TÀI KHOẢN & ĐĂNG NHẬP</Text>
        <View style={[styles.settingsGroup, { backgroundColor: theme.card }]}>
          {/* Nút Đổi sang tài khoản khác */}
          <TouchableOpacity
            style={[styles.settingsRow, { borderBottomColor: theme.divider }]}
            onPress={handleSwitchAccount}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIconBox, { backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : '#FEF3C7' }]}>
              <Ionicons name="swap-horizontal" size={18} color="#F59E0B" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: '#F59E0B' }]}>Đổi sang tài khoản khác</Text>
              <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                Đăng nhập tài khoản TikTok khác trên thiết bị này
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#F59E0B" />
          </TouchableOpacity>

          {/* Nút Đăng xuất */}
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIconBox, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
              <Ionicons name="log-out" size={18} color="#EF4444" />
            </View>
            <View style={styles.rowContent}>
              <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Đăng xuất</Text>
              <Text style={[styles.rowSub, { color: theme.textMuted }]}>
                Xóa phiên làm việc hiện tại và quay về màn hình đăng nhập
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* ================================================================= */}
        {/* MỤC 4: TÙY CHỌN NHÀ PHÁT TRIỂN (DEV MODE) */}
        {/* ================================================================= */}
        {isDevMode && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
              <Ionicons name="code-slash" size={16} color="#0284C7" style={{ marginRight: 6 }} />
              <Text style={[styles.sectionHeaderTitle, { color: '#0284C7', marginTop: 0, marginBottom: 0 }]}>
                TÙY CHỌN NHÀ PHÁT TRIỂN (DEV MODE)
              </Text>
            </View>
            <View style={[styles.settingsGroup, { backgroundColor: theme.card, borderColor: '#0284C7', borderWidth: 1 }]}>
              {/* Bật/Tắt Dev Mode */}
              <View style={[styles.settingsRow, { borderBottomColor: theme.divider }]}>
                <View style={[styles.rowIconBox, { backgroundColor: 'rgba(2, 132, 199, 0.15)' }]}>
                  <Ionicons name="bug-outline" size={18} color="#0284C7" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Chế độ Dev Mode</Text>
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                    Bật bảng gỡ lỗi realtime và thông số fetch API
                  </Text>
                </View>
                <Switch
                  value={isDevMode}
                  onValueChange={async (val) => {
                    await debugLogger.setDevMode(val);
                    setIsDevMode(val);
                  }}
                  trackColor={{ false: theme.surface, true: '#0284C7' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {/* Mở toàn bộ nhật ký hệ thống */}
              <TouchableOpacity
                style={[styles.settingsRow, { borderBottomColor: theme.divider }]}
                onPress={() => setShowLogsModal(true)}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIconBox, { backgroundColor: theme.surface }]}>
                  <Ionicons name="terminal-outline" size={18} color="#38BDF8" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: theme.textPrimary }]}>Xem toàn bộ nhật ký hệ thống</Text>
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                    {devLogs.length} sự kiện log đã ghi nhận
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </TouchableOpacity>

              {/* Xóa toàn bộ log */}
              <TouchableOpacity
                style={styles.settingsRow}
                onPress={() => {
                  debugLogger.clearLogs();
                  if (Platform.OS === 'android') {
                    ToastAndroid.show('Đã làm sạch toàn bộ log debug.', ToastAndroid.SHORT);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.rowIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </View>
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Xóa toàn bộ log debug</Text>
                  <Text style={[styles.rowSub, { color: theme.textSecondary }]}>
                    Giải phóng bộ nhớ đệm log trong app
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Footer thông tin bản quyền */}
        <View style={styles.infoFooter}>
          <Text style={[styles.infoFooterText, { color: theme.textMuted }]}>
            TikTokToe - v1.1.0 {isDevMode ? '(Dev Mode Enabled)' : ''}
          </Text>
          <Text style={[styles.infoFooterSub, { color: theme.textMuted }]}>
            Powered by FaWe
          </Text>
        </View>
      </ScrollView>

      {/* Modal Toàn Bộ Nhật Ký Hệ Thống */}
      <Modal
        visible={showLogsModal}
        animationType="slide"
        onRequestClose={() => setShowLogsModal(false)}
      >
        <SafeAreaView style={[styles.modalLogContainer, { backgroundColor: '#0B1120' }]}>
          <View style={styles.modalLogHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="terminal" size={18} color="#38BDF8" style={{ marginRight: 8 }} />
              <Text style={styles.modalLogTitle}>Nhật Ký Hệ Thống (Dev Mode)</Text>
              <View style={styles.modalLogCountBadge}>
                <Text style={styles.modalLogCountText}>{devLogs.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.modalLogCloseBtn}
              onPress={() => setShowLogsModal(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalLogActionBar}>
            <TouchableOpacity style={styles.modalLogActionBtn} onPress={handleCopyAllLogs}>
              <Ionicons name="copy-outline" size={15} color="#38BDF8" style={{ marginRight: 6 }} />
              <Text style={styles.modalLogActionText}>Sao Chép Toàn Bộ Log</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalLogActionBtn, { borderColor: '#EF4444' }]}
              onPress={() => {
                debugLogger.clearLogs();
                if (Platform.OS === 'android') ToastAndroid.show('Đã xóa log.', ToastAndroid.SHORT);
              }}
            >
              <Ionicons name="trash-outline" size={15} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={[styles.modalLogActionText, { color: '#EF4444' }]}>Xóa Log</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalLogScrollView} contentContainerStyle={{ padding: 12 }}>
            {devLogs.length === 0 ? (
              <Text style={styles.modalLogEmpty}>Chưa có log nào được ghi lại.</Text>
            ) : (
              devLogs.map((item) => {
                const color =
                  item.level === 'error'
                    ? '#EF4444'
                    : item.level === 'warn'
                    ? '#F59E0B'
                    : item.level === 'success'
                    ? '#10B981'
                    : '#38BDF8';
                return (
                  <View key={item.id} style={styles.modalLogRow}>
                    <View style={styles.modalLogRowMeta}>
                      <Text style={styles.modalLogTime}>{item.timestamp}</Text>
                      <View style={[styles.modalLogLevelPill, { borderColor: color }]}>
                        <Text style={[styles.modalLogLevelText, { color }]}>
                          {item.level.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.modalLogModule}>[{item.module}]</Text>
                    </View>
                    <Text
                      style={[
                        styles.modalLogMsg,
                        { color: item.level === 'error' ? '#FCA5A5' : '#F1F5F9' },
                      ]}
                      selectable
                    >
                      {item.message}
                    </Text>
                    {item.details ? (
                      <Text style={styles.modalLogDetails} selectable>
                        {item.details}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Modal cảnh báo Danger chuẩn phong cách Xiaomi/MIUI */}
      <DangerSecurityModal
        visible={showDangerModal}
        onConfirm={handleConfirmDangerUnlock}
        onCancel={handleCancelDangerUnlock}
      />
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  /* Profile Card Top */
  profileCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  profileLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  profileLoadingText: {
    fontSize: 13,
    marginLeft: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfoCol: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '800',
    maxWidth: 190,
  },
  profileUsername: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '500',
  },
  profileBio: {
    fontSize: 11,
    marginTop: 2,
    fontStyle: 'italic',
  },
  profileUid: {
    fontSize: 10,
    marginTop: 3,
    fontFamily: 'monospace',
  },

  /* Section Headers & Group Cards */
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginLeft: 4,
  },
  settingsGroup: {
    borderRadius: 14,
    marginBottom: 18,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
  chipBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  chipBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },

  /* Sub-view: Chi Tiết Tài Khoản */
  largeAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  largeAvatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCardName: {
    fontSize: 18,
    fontWeight: '800',
  },
  profileCardUsername: {
    fontSize: 14,
    marginTop: 2,
  },
  profileBioText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    maxWidth: 200,
    textAlign: 'right',
  },
  switchAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 18,
    marginBottom: 30,
  },
  switchAccountBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  /* Sub-view: Gemini AI Settings */
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiIconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  apiKeyInput: {
    flex: 1,
    fontSize: 13,
  },
  eyeBtn: {
    padding: 4,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  testBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  testBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  testResultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  testResultText: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  tipText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  styleOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  styleChipText: {
    fontSize: 12,
  },
  sampleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  sampleBtnText: {
    fontWeight: '700',
    fontSize: 13,
  },
  sampleResultBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
  },
  sampleResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sampleResultLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  sampleResultText: {
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    lineHeight: 18,
  },

  /* Footer */
  infoFooter: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 30,
  },
  infoFooterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoFooterSub: {
    fontSize: 10,
    marginTop: 2,
  },
  activeModelBox: {
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  activeModelLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeModelValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  activeModelDesc: {
    fontSize: 11,
    flex: 1,
    lineHeight: 15,
  },
  sampleSourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  sampleSourceText: {
    fontSize: 10,
    fontWeight: '700',
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  themeOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
  },
  themeOptionText: {
    fontSize: 13,
  },
  headerTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  devModeHeaderBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  devModeHeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  /* Modal System Logs */
  modalLogContainer: {
    flex: 1,
  },
  modalLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalLogTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  modalLogCountBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  modalLogCountText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  modalLogCloseBtn: {
    padding: 4,
  },
  modalLogActionBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  modalLogActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0284C7',
    backgroundColor: '#1E293B',
  },
  modalLogActionText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalLogScrollView: {
    flex: 1,
  },
  modalLogEmpty: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 40,
    fontStyle: 'italic',
  },
  modalLogRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingVertical: 8,
  },
  modalLogRowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  modalLogTime: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  modalLogLevelPill: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
  },
  modalLogLevelText: {
    fontSize: 9,
    fontWeight: '800',
  },
  modalLogModule: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  modalLogMsg: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  modalLogDetails: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    backgroundColor: '#0F172A',
    padding: 8,
    borderRadius: 6,
  },
});
