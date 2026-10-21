import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';

export default function BottomNavBar({ activeTab, onSelectTab, conversationCount = 0 }) {
  const { theme } = useTheme();

  const tabs = [
    {
      id: 'HOME',
      label: 'Trang chủ',
      iconActive: 'home',
      iconInactive: 'home-outline',
    },
    {
      id: 'CONVERSATIONS',
      label: 'Hộp thư',
      iconActive: 'chatbubble-ellipses',
      iconInactive: 'chatbubble-ellipses-outline',
      badge: conversationCount > 0 ? (conversationCount > 99 ? '99+' : String(conversationCount)) : null,
    },
    {
      id: 'DOWNLOADER',
      label: 'Tải Video',
      iconActive: 'cloud-download',
      iconInactive: 'cloud-download-outline',
      tag: 'HOT',
    },
    {
      id: 'SETTINGS',
      label: 'Cài đặt',
      iconActive: 'settings',
      iconInactive: 'settings-outline',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.bgSecondary, borderTopColor: theme.divider }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const iconName = isActive ? tab.iconActive : tab.iconInactive;
        const tintColor = isActive ? theme.tiktokRed : theme.textMuted;

        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabButton}
            onPress={() => onSelectTab(tab.id)}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={iconName} size={22} color={tintColor} />

              {/* Huy hiệu số lượng tin nhắn */}
              {tab.badge && (
                <View style={[styles.badge, { backgroundColor: theme.tiktokRed }]}>
                  <Text style={styles.badgeText}>{tab.badge}</Text>
                </View>
              )}

              {/* Tag HOT hoặc MỚI */}
              {tab.tag && (
                <View style={styles.hotTag}>
                  <Text style={styles.hotTagText}>{tab.tag}</Text>
                </View>
              )}
            </View>

            <Text
              style={[
                styles.tabLabel,
                { color: tintColor, fontWeight: isActive ? '700' : '500' },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>

            {/* Chỉ báo thanh tab đang kích hoạt */}
            {isActive && <View style={[styles.activeIndicator, { backgroundColor: theme.tiktokRed }]} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 60,
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    position: 'relative',
  },
  iconContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 26,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  hotTag: {
    position: 'absolute',
    top: -5,
    right: -14,
    backgroundColor: '#FF8800',
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 4,
  },
  hotTagText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    width: 28,
    height: 3,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
