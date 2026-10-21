import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  SafeAreaView,
  TextInput,
  Platform,
  Alert,
  ToastAndroid,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../constants/ThemeContext';
import { fetchCurrentAccountProfile, fetchConversationList } from '../services/tiktokApi';
import { scheduleWorker } from '../services/scheduleWorker';
import { nativeBackgroundService } from '../services/nativeBackgroundService';

const CACHED_PROFILE_KEY = 'TIKTOK_CACHED_MY_PROFILE_V2';

export default function HomeScreen({
  cookieStr = '',
  onNavigate,
  onOpenDownloaderWithUrl,
}) {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const [profile, setProfile] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [convCount, setConvCount] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [isBgEnabled, setIsBgEnabled] = useState(scheduleWorker.isBgServiceEnabled);
  const [quickUrl, setQuickUrl] = useState('');

  const showToast = (msg) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Thông báo', msg);
    }
  };

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);

    try {
      // 1. Load cached profile
      if (!profile) {
        const stored = await AsyncStorage.getItem(CACHED_PROFILE_KEY);
        if (stored) {
          try {
            setProfile(JSON.parse(stored));
          } catch (_) {}
        }
      }

      // 2. Fetch latest profile from API
      if (cookieStr) {
        fetchCurrentAccountProfile(cookieStr)
          .then((prof) => {
            if (prof) {
              setProfile(prof);
              AsyncStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(prof)).catch(() => {});
            }
          })
          .catch(() => {});
      }

      // 3. Count conversations and active streaks
      const schedMap = scheduleWorker.getActiveConversationMap ? scheduleWorker.getActiveConversationMap() : {};
      const activeStreaks = Object.values(schedMap).filter((s) => s.isStreak || s.hasSchedule).length;
      setStreakCount(activeStreaks);

      fetchConversationList(cookieStr)
        .then((list) => {
          if (Array.isArray(list)) {
            setConvCount(list.length);
          }
        })
        .catch(() => {});

      setIsBgEnabled(scheduleWorker.isBgServiceEnabled);
    } catch (err) {
      console.warn('Lỗi loadData HomeScreen:', err);
    } finally {
      setRefreshing(false);
    }
  }, [cookieStr, profile]);

  useEffect(() => {
    loadData();

    const unsub = scheduleWorker.subscribe(() => {
      const schedMap = scheduleWorker.getActiveConversationMap ? scheduleWorker.getActiveConversationMap() : {};
      const activeStreaks = Object.values(schedMap).filter((s) => s.isStreak || s.hasSchedule).length;
      setStreakCount(activeStreaks);
      setIsBgEnabled(scheduleWorker.isBgServiceEnabled);
    });

    return unsub;
  }, [loadData]);

  // Toggle background auto service
  const handleToggleBgService = async () => {
    const nextVal = !isBgEnabled;
    setIsBgEnabled(nextVal);
    await scheduleWorker.setBackgroundServiceEnabled(nextVal);
    showToast(nextVal ? 'Đã bật dịch vụ nền tự động.' : 'Đã tắt dịch vụ nền tự động.');
  };

  // Quick paste link from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await nativeBackgroundService.getClipboardText();
      if (text && text.trim()) {
        setQuickUrl(text.trim());
        showToast('Đã dán từ bộ nhớ tạm!');
      } else {
        showToast('Bộ nhớ tạm đang trống!');
      }
    } catch (_) {
      showToast('Không thể đọc bộ nhớ tạm.');
    }
  };

  // Quick download video from input
  const handleQuickDownload = () => {
    if (!quickUrl.trim()) {
      Alert.alert('Chưa có link', 'Vui lòng dán link TikTok trước khi tải!');
      return;
    }
    if (onOpenDownloaderWithUrl) {
      onOpenDownloaderWithUrl(quickUrl.trim());
    } else {
      onNavigate('DOWNLOADER');
    }
  };

  // Open downloader directly from audio extraction or paste action
  const handleOpenDownloaderDirectly = async (autoPaste = false) => {
    if (autoPaste) {
      try {
        const text = await nativeBackgroundService.getClipboardText();
        if (text && text.trim()) {
          if (onOpenDownloaderWithUrl) {
            onOpenDownloaderWithUrl(text.trim());
            return;
          }
        }
      } catch (_) {}
    }
    onNavigate('DOWNLOADER');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* 1. Main Hub header (Brand logo, borderless status pill, action buttons) */}
      <View style={[styles.topHeader, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
        <View style={styles.brandRow}>
          <View style={[styles.brandIconWrapper, { backgroundColor: 'rgba(254, 44, 85, 0.12)' }]}>
            <Ionicons name="flame" size={20} color={theme.tiktokRed} />
          </View>
          <View style={{ marginLeft: 8 }}>
            <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>TikTokToe</Text>
            <Text style={[styles.brandSub, { color: theme.tiktokRed }]}>STUDIO HUB</Text>
          </View>
        </View>

        <View style={styles.headerRightActions}>
          {/* Background service status pill (borderless) */}
          <TouchableOpacity
            style={[
              styles.statusPillNoBorder,
              {
                backgroundColor: isBgEnabled
                  ? (isDarkMode ? 'rgba(16, 185, 129, 0.18)' : '#ECFDF5')
                  : (isDarkMode ? 'rgba(239, 68, 68, 0.18)' : '#FEF2F2'),
              },
            ]}
            onPress={handleToggleBgService}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isBgEnabled ? '#10B981' : '#EF4444' },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                { color: isBgEnabled ? '#10B981' : '#EF4444' },
              ]}
            >
              {isBgEnabled ? 'Dịch vụ nền BẬT' : 'Dịch vụ nền TẮT'}
            </Text>
          </TouchableOpacity>

          {/* Theme switch button */}
          <TouchableOpacity
            style={[styles.circleActionBtn, { backgroundColor: theme.surface }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon'}
              size={17}
              color={isDarkMode ? '#F59E0B' : '#8B5CF6'}
            />
          </TouchableOpacity>

          {/* Settings button */}
          <TouchableOpacity
            style={[styles.circleActionBtn, { backgroundColor: theme.surface }]}
            onPress={() => onNavigate('SETTINGS')}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={17} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={{ paddingBottom: 50 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={theme.tiktokRed} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. User Profile Hero Card (Avatar, Nickname, Handle, UID) */}
        <View style={[styles.profileHeroCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}>
          <View style={styles.profileHeroRow}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.userAvatarClean} />
            ) : (
              <View style={[styles.userAvatarCleanPlaceholder, { backgroundColor: theme.surface }]}>
                <Ionicons name="person" size={28} color={theme.textPrimary} />
              </View>
            )}

            <View style={styles.profileTextCol}>
              <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
                {profile?.nickname || 'Tài Khoản TikTok'}
              </Text>
              <Text style={[styles.userHandle, { color: theme.textSecondary }]} numberOfLines={1}>
                {profile?.uniqueId ? `@${profile.uniqueId}` : 'Đã kết nối phiên TikTok'}
              </Text>
              {profile?.uid && (
                <Text style={[styles.uidText, { color: theme.textMuted }]}>
                  UID: {profile.uid}
                </Text>
              )}
            </View>

            <View style={[styles.sessionStatusBadge, { backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.14)' : '#ECFDF5' }]}>
              <View style={styles.sessionDot} />
              <Text style={styles.sessionText}>Trực tuyến</Text>
            </View>
          </View>
        </View>

        {/* 3. Floating 3-card summary bar */}
        <View style={[styles.floatingSummaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Card 1: Inbox */}
          <TouchableOpacity
            style={styles.summaryItem}
            activeOpacity={0.7}
            onPress={() => onNavigate('CONVERSATIONS')}
          >
            <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.summaryTitle, { color: theme.textPrimary }]}>Hộp thư</Text>
            <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>
              {convCount > 0 ? `${convCount} đoạn chat` : 'Trò chuyện'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.summaryDivider, { backgroundColor: theme.divider }]} />

          {/* Card 2: Fire Streak */}
          <TouchableOpacity
            style={styles.summaryItem}
            activeOpacity={0.7}
            onPress={() => onNavigate('CONVERSATIONS')}
          >
            <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(249, 115, 22, 0.12)' }]}>
              <Ionicons name="flame" size={20} color="#F97316" />
            </View>
            <Text style={[styles.summaryTitle, { color: theme.textPrimary }]}>Chuỗi lửa</Text>
            <Text style={[styles.summaryValue, { color: '#F97316' }]}>
              {streakCount > 0 ? `${streakCount} đang giữ` : 'Tự động 24/7'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.summaryDivider, { backgroundColor: theme.divider }]} />

          {/* Card 3: Video Downloader */}
          <TouchableOpacity
            style={styles.summaryItem}
            activeOpacity={0.7}
            onPress={() => onNavigate('DOWNLOADER')}
          >
            <View style={[styles.summaryIconCircle, { backgroundColor: 'rgba(254, 44, 85, 0.12)' }]}>
              <Ionicons name="cloud-download" size={20} color={theme.tiktokRed} />
            </View>
            <Text style={[styles.summaryTitle, { color: theme.tiktokRed }]}>Tải Video</Text>
            <Text style={[styles.summaryValue, { color: theme.textSecondary }]}>No Watermark</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Feature icon grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Dịch Vụ & Tiện Ích</Text>
          <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>Chọn chức năng muốn sử dụng</Text>
        </View>

        <View style={[styles.featureGrid, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.gridRow}>
            {/* 1. Messages and streaks */}
            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.7}
              onPress={() => onNavigate('CONVERSATIONS')}
            >
              <View style={[styles.gridIconBox, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                <Ionicons name="chatbubble-ellipses" size={24} color="#3B82F6" />
              </View>
              <Text style={[styles.gridLabel, { color: theme.textPrimary }]}>Tin nhắn</Text>
              <Text style={[styles.gridSubLabel, { color: theme.textMuted }]}>& Giữ chuỗi</Text>
            </TouchableOpacity>

            {/* 2. Video downloader */}
            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.7}
              onPress={() => onNavigate('DOWNLOADER')}
            >
              <View style={[styles.gridIconBox, { backgroundColor: 'rgba(254, 44, 85, 0.12)' }]}>
                <Ionicons name="cloud-download" size={24} color={theme.tiktokRed} />
              </View>
              <Text style={[styles.gridLabel, { color: theme.textPrimary }]}>Tải Video</Text>
              <Text style={[styles.gridSubLabel, { color: theme.textMuted }]}>MP4 HD & MP3</Text>
            </TouchableOpacity>

            {/* 3. Audio extraction */}
            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.7}
              onPress={() => handleOpenDownloaderDirectly(false)}
            >
              <View style={[styles.gridIconBox, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Ionicons name="musical-notes" size={24} color="#F59E0B" />
              </View>
              <Text style={[styles.gridLabel, { color: theme.textPrimary }]}>Tách Nhạc</Text>
              <Text style={[styles.gridSubLabel, { color: theme.textMuted }]}>Audio MP3</Text>
            </TouchableOpacity>

            {/* 4. Quick paste from clipboard */}
            <TouchableOpacity
              style={styles.gridItem}
              activeOpacity={0.7}
              onPress={() => handleOpenDownloaderDirectly(true)}
            >
              <View style={[styles.gridIconBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                <Ionicons name="clipboard" size={24} color="#10B981" />
              </View>
              <Text style={[styles.gridLabel, { color: theme.textPrimary }]}>Dán Link</Text>
              <Text style={[styles.gridSubLabel, { color: theme.textMuted }]}>Từ Clipboard</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. Featured banner card */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Tính Năng Nổi Bật</Text>
        </View>

        <TouchableOpacity
          style={[styles.featureBannerCard, { backgroundColor: isDarkMode ? '#1C1917' : '#FFF7ED' }]}
          activeOpacity={0.8}
          onPress={() => onNavigate('CONVERSATIONS')}
        >
          <View style={styles.bannerContentCol}>
            <Text style={[styles.bannerMainTitle, { color: theme.textPrimary }]}>
              Tự Động Giữ Chuỗi Lửa 24/7
            </Text>
            <Text style={[styles.bannerDescription, { color: theme.textSecondary }]}>
              Hệ thống tự động gửi tin nhắn đúng giờ hẹn hàng ngày để duy trì biểu tượng ngọn lửa với bạn bè liên tục.
            </Text>
          </View>

          <View style={styles.bannerGraphicWrapper}>
            <View style={[styles.graphicCircle, { backgroundColor: 'rgba(249, 115, 22, 0.18)' }]}>
              <Ionicons name="flame" size={32} color="#F97316" />
            </View>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: -2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Borderless status pill
  statusPillNoBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  circleActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileHeroCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatarClean: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  userAvatarCleanPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 12,
    marginTop: 2,
  },
  uidText: {
    fontSize: 10,
    marginTop: 2,
  },
  sessionStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  sessionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 4,
  },
  sessionText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  floatingSummaryCard: {
    flexDirection: 'row',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
    marginTop: 12,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: 11,
    marginTop: 1,
  },
  summaryDivider: {
    width: 1,
    height: 34,
  },
  sectionHeaderRow: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSub: {
    fontSize: 11,
    marginTop: 2,
  },
  // Feature grid style
  featureGrid: {
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  gridItem: {
    flex: 1,
    alignItems: 'center',
  },
  gridIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  gridLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  gridSubLabel: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 1,
  },
  featureBannerCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerContentCol: {
    flex: 1,
    paddingRight: 10,
  },
  bannerMainTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  bannerDescription: {
    fontSize: 11,
    lineHeight: 16,
  },
  bannerGraphicWrapper: {
    width: 54,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  graphicCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
