import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchConversationList } from '../services/tiktokApi';
import { scheduleWorker } from '../services/scheduleWorker';
import { useTheme } from '../constants/ThemeContext';

let memoryConversationCache = null;

export function clearConversationCache() {
  memoryConversationCache = null;
}

export default function ConversationListScreen({
  cookieStr,
  onSelectConversation,
  onOpenSettings,
  onLogout,
  onBack,
}) {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const [conversations, setConversations] = useState(memoryConversationCache || []);
  const [filtered, setFiltered] = useState(
    memoryConversationCache ? memoryConversationCache.filter((c) => c.isFriend) : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('FRIENDS'); // Mặc định hiển thị tab Bạn bè
  const [activeScheduleMap, setActiveScheduleMap] = useState(
    scheduleWorker.getActiveConversationMap ? scheduleWorker.getActiveConversationMap() : {}
  );
  const [loading, setLoading] = useState(!memoryConversationCache);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = scheduleWorker.subscribe(() => {
      if (scheduleWorker.getActiveConversationMap) {
        setActiveScheduleMap(scheduleWorker.getActiveConversationMap());
      }
    });
    return unsubscribe;
  }, []);

  const applyFilter = useCallback(
    (sourceList, query, tab, schedMap) => {
      let result = sourceList;

      // 1. Lọc theo Tab Phân Loại
      if (tab === 'FRIENDS') {
        result = result.filter((c) => c.isFriend);
      } else if (tab === 'STRANGERS') {
        result = result.filter((c) => c.isStranger);
      } else if (tab === 'STREAKS') {
        result = result.filter((c) => schedMap[c.conversationId]?.isStreak || schedMap[c.conversationId]?.hasSchedule);
      }

      // 2. Lọc theo từ khóa tìm kiếm
      if (query && query.trim()) {
        const q = query.toLowerCase();
        result = result.filter(
          (c) =>
            (c.nickname && c.nickname.toLowerCase().includes(q)) ||
            (c.uniqueId && c.uniqueId.toLowerCase().includes(q)) ||
            (c.lastMessageText && c.lastMessageText.toLowerCase().includes(q))
        );
      }

      return result;
    },
    []
  );

  useEffect(() => {
    setFiltered(applyFilter(conversations, searchQuery, filterType, activeScheduleMap));
  }, [conversations, searchQuery, filterType, activeScheduleMap, applyFilter]);

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!memoryConversationCache) setLoading(true);
    setError(null);

    try {
      const data = await fetchConversationList(cookieStr);
      memoryConversationCache = data;
      setConversations(data);
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách đoạn chat');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cookieStr]);

  useEffect(() => {
    if (!memoryConversationCache) {
      loadData();
    }
  }, [loadData]);

  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Hôm qua';
    }
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  // Tính số lượng cho từng bộ lọc
  const friendsCount = conversations.filter((c) => c.isFriend).length;
  const strangersCount = conversations.filter((c) => c.isStranger).length;
  const streaksCount = conversations.filter(
    (c) => activeScheduleMap[c.conversationId]?.isStreak || activeScheduleMap[c.conversationId]?.hasSchedule
  ).length;

  // Render từng item hội thoại chuẩn TikTok với badge nhận diện
  const renderItem = ({ item }) => {
    const timeStr = formatTimestamp(item.lastMessageTime || item.updatedTime);
    const activeSched = activeScheduleMap[item.conversationId];

    return (
      <TouchableOpacity
        style={[styles.chatCard, { backgroundColor: theme.card, borderBottomColor: theme.divider }]}
        activeOpacity={0.65}
        onPress={() => onSelectConversation(item)}
      >
        {/* Avatar chuẩn TikTok */}
        <View style={styles.avatarWrapper}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatarPlaceholder,
                { backgroundColor: item.isGroup ? (isDarkMode ? '#1E293B' : '#E2E8F0') : (isDarkMode ? '#282933' : '#E5E7EB') },
              ]}
            >
              {item.isGroup ? (
                <Ionicons name="people" size={22} color={isDarkMode ? '#FFFFFF' : '#1E293B'} />
              ) : (
                <Text style={[styles.avatarInitial, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                  {item.nickname ? item.nickname.charAt(0).toUpperCase() : '?'}
                </Text>
              )}
            </View>
          )}

          {/* Dấu hiệu góc Avatar: Icon Giữ chuỗi (Flame) hoặc Hẹn giờ (Time) */}
          {activeSched?.isStreak ? (
            <View style={styles.avatarStreakIconWrapper}>
              <Ionicons name="flame" size={10} color="#FFFFFF" />
            </View>
          ) : activeSched?.hasSchedule ? (
            <View style={styles.avatarScheduleIconWrapper}>
              <Ionicons name="time" size={10} color="#FFFFFF" />
            </View>
          ) : null}
        </View>

        {/* Nội dung thông tin cuộc trò chuyện */}
        <View style={styles.chatInfo}>
          <View style={styles.rowTop}>
            <View style={styles.nameRow}>
              {/* Nhóm: Label màu TikTok đỏ nổi bật */}
              {item.isGroup ? (
                <View style={styles.groupBadgeTiktok}>
                  <Ionicons name="people" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.groupBadgeTiktokText}>Nhóm</Text>
                </View>
              ) : item.isStranger ? (
                /* Người lạ: Label kiểu dáng giống TikTok nhưng xám */
                <View style={[styles.strangerBadgeGray, { backgroundColor: isDarkMode ? '#3F3F46' : '#6B7280' }]}>
                  <Ionicons name="person-outline" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.strangerBadgeGrayText}>Người lạ</Text>
                </View>
              ) : null /* Bạn bè không cần label */}

              {/* Dấu hiệu setup Giữ chuỗi (Streak) hoặc Hẹn giờ */}
              {activeSched?.isStreak ? (
                <View style={[styles.streakBadge, { backgroundColor: isDarkMode ? 'rgba(249, 115, 22, 0.18)' : '#FFF7ED' }]}>
                  <Ionicons name="flame" size={10} color="#F97316" style={{ marginRight: 2 }} />
                  <Text style={[styles.streakBadgeText, { color: '#F97316' }]}>Giữ chuỗi</Text>
                </View>
              ) : activeSched?.hasSchedule ? (
                <View style={[styles.scheduleBadge, { backgroundColor: theme.surface }]}>
                  <Ionicons name="time-outline" size={10} color={theme.textPrimary} style={{ marginRight: 2 }} />
                  <Text style={[styles.scheduleBadgeText, { color: theme.textPrimary }]}>Đã hẹn</Text>
                </View>
              ) : null}

              <Text style={[styles.nickname, { color: theme.textPrimary }]} numberOfLines={1}>
                {item.nickname}
              </Text>
            </View>
            <Text style={[styles.timeText, { color: theme.textSecondary }]}>{timeStr}</Text>
          </View>

          {item.uniqueId ? (
            <Text style={[styles.uniqueId, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.isGroup ? item.uniqueId : `@${item.uniqueId}`}
            </Text>
          ) : null}

          <View style={styles.rowBottom}>
            <Text
              style={[styles.lastMessage, { color: theme.textSecondary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.lastMessageText}
            </Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* TikTok Top Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
        <View style={styles.headerTitleRow}>
          {onBack && (
            <TouchableOpacity style={{ marginRight: 6, padding: 2 }} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={theme.iconColor} />
            </TouchableOpacity>
          )}
          <Ionicons name="chatbubble-ellipses" size={22} color={theme.tiktokRed} style={{ marginRight: 8 }} />
          <View>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Hộp thư</Text>
            <Text style={[styles.headerCount, { color: theme.textSecondary }]}>
              {filtered.length}/{conversations.length} cuộc hội thoại
            </Text>
          </View>
        </View>

        {/* Cụm công cụ bên phải: Chuyển Dark/Light Mode & Cài Đặt */}
        <View style={styles.headerActions}>
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

          <TouchableOpacity
            style={[styles.settingsBtn, { backgroundColor: theme.surface }]}
            onPress={onOpenSettings}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={17} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh Tìm Kiếm chuẩn TikTok */}
      <View style={[styles.searchBox, { backgroundColor: theme.inputBg }]}>
        <Ionicons name="search" size={16} color={theme.iconMuted} style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.searchInput, { color: theme.textPrimary }]}
          placeholder="Tìm theo tên, @username hoặc tin nhắn..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={handleSearch}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={16} color={theme.iconMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Thanh Filter Bar chuẩn TikTok với icon thư viện */}
      <View style={styles.filterBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
          {/* Bộ lọc: Tất cả */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filterType === 'ALL' ? theme.tiktokRed : theme.surface },
            ]}
            onPress={() => setFilterType('ALL')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={13}
              color={filterType === 'ALL' ? '#FFFFFF' : theme.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'ALL' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Tất cả ({conversations.length})
            </Text>
          </TouchableOpacity>

          {/* Bộ lọc: Bạn bè */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filterType === 'FRIENDS' ? theme.tiktokRed : theme.surface },
            ]}
            onPress={() => setFilterType('FRIENDS')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="people-outline"
              size={13}
              color={filterType === 'FRIENDS' ? '#FFFFFF' : theme.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'FRIENDS' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Bạn bè ({friendsCount})
            </Text>
          </TouchableOpacity>

          {/* Bộ lọc: Người lạ */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filterType === 'STRANGERS' ? theme.tiktokRed : theme.surface },
            ]}
            onPress={() => setFilterType('STRANGERS')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="person-outline"
              size={13}
              color={filterType === 'STRANGERS' ? '#FFFFFF' : theme.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'STRANGERS' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Người lạ ({strangersCount})
            </Text>
          </TouchableOpacity>

          {/* Bộ lọc: Giữ chuỗi */}
          <TouchableOpacity
            style={[
              styles.filterChip,
              { backgroundColor: filterType === 'STREAKS' ? theme.tiktokRed : theme.surface },
            ]}
            onPress={() => setFilterType('STREAKS')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="flame-outline"
              size={13}
              color={filterType === 'STREAKS' ? '#FFFFFF' : theme.textSecondary}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: filterType === 'STREAKS' ? '#FFFFFF' : theme.textSecondary },
              ]}
            >
              Giữ chuỗi ({streaksCount})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Trạng Thái Tải Hoặc Lỗi */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.tiktokRed} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Đang đồng bộ hộp thư TikTok...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.tiktokRed} style={{ marginBottom: 12 }} />
          <Text style={[styles.errorText, { color: theme.textPrimary }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.tiktokRed }]}
            onPress={() => loadData(true)}
          >
            <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.conversationId}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={theme.tiktokRed}
              colors={[theme.tiktokRed]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="chatbubbles-outline" size={44} color={theme.iconMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchQuery
                  ? 'Không tìm thấy cuộc trò chuyện phù hợp'
                  : filterType === 'FRIENDS'
                  ? 'Không có cuộc trò chuyện bạn bè nào'
                  : filterType === 'STRANGERS'
                  ? 'Không có cuộc trò chuyện người lạ nào'
                  : filterType === 'STREAKS'
                  ? 'Chưa có cuộc trò chuyện nào được cài giữ chuỗi'
                  : 'Chưa có cuộc trò chuyện nào trong danh sách'}
              </Text>
            </View>
          }
        />
      )}
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
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  headerCount: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  themeToggleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 18,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 20,
  },
  chatCard: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  avatarWrapper: {
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  filterBarWrapper: {
    paddingBottom: 6,
  },
  filterBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 6,
  },
  filterChipActive: {},
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  avatarStreakIconWrapper: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  avatarScheduleIconWrapper: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  groupBadgeTiktok: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FE2C55',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  groupBadgeTiktokText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  strangerBadgeGray: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  strangerBadgeGrayText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginRight: 5,
  },
  streakBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  scheduleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginRight: 5,
  },
  scheduleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  groupBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  nickname: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  uniqueId: {
    fontSize: 12,
    marginTop: 2,
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  lastMessage: {
    fontSize: 13,
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
  },
  workerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  workerBannerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 30,
  },
});
