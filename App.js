import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  View,
  Platform,
  StatusBar as RNStatusBar,
  AppState,
  BackHandler,
  Animated,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LoginWebViewScreen,
  HomeScreen,
  ConversationListScreen,
  clearConversationCache,
  VideoDownloaderScreen,
  ChatDetailScreen,
  SettingsScreen,
} from './src/screens';
import {
  BottomNavBar,
  BackgroundTokenRefresher,
} from './src/components';
import {
  DEFAULT_SESSION_COOKIES,
  cookieObjToString,
  ThemeProvider,
  useTheme,
} from './src/constants';
import { scheduleWorker } from './src/services';

const COOKIE_STORAGE_KEY = 'TIKTOK_ACTIVE_COOKIE_V1';

function MainApp() {
  const { theme, isDarkMode } = useTheme();
  const [cookieStr, setCookieStr] = useState(cookieObjToString(DEFAULT_SESSION_COOKIES));

  // Mặc định khởi động vào HUB HomeScreen thay vì vào thẳng tin nhắn
  const [currentScreen, setCurrentScreen] = useState(cookieStr ? 'HOME' : 'LOGIN');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  // Lưu vết lịch sử trang (Point 15: Quay lại trang trước thay vì thoát app)
  const [navigationHistory, setNavigationHistory] = useState(['HOME']);
  const historyRef = useRef(['HOME']);

  // URL truyền nhanh vào trình tải video
  const [downloaderInitialUrl, setDownloaderInitialUrl] = useState('');

  // Animation mượt mà khi chuyển tab/trang (Point 14)
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // Cập nhật ref mỗi khi history thay đổi
  const updateHistory = (newHistory) => {
    historyRef.current = newHistory;
    setNavigationHistory(newHistory);
  };

  // Hàm điều hướng chuyên nghiệp có lưu vết
  const navigateTo = (screenName) => {
    if (screenName === currentScreen) return;

    const prev = historyRef.current;
    // Tránh lưu trùng lặp nếu quay lại chính trang trước đó
    const newHistory = [...prev.filter((s) => s !== screenName), screenName];
    updateHistory(newHistory);
    setCurrentScreen(screenName);
  };

  // Quay lại trang trước trong lịch sử
  const goBack = () => {
    if (currentScreen === 'CHAT_DETAIL') {
      setSelectedConversation(null);
      setCurrentScreen('CONVERSATIONS');
      return true;
    }

    const currentHist = historyRef.current;
    if (currentHist.length > 1) {
      const nextHist = [...currentHist];
      nextHist.pop(); // Bỏ trang hiện tại
      const prevScreen = nextHist[nextHist.length - 1];
      updateHistory(nextHist);
      setCurrentScreen(prevScreen);
      return true;
    }

    if (currentScreen !== 'HOME') {
      setCurrentScreen('HOME');
      updateHistory(['HOME']);
      return true;
    }

    return false; // Ở trang gốc HOME -> cho phép thoát app
  };

  // Hiệu ứng animation chuyển cảnh
  useEffect(() => {
    fadeAnim.setValue(0.5);
    translateYAnim.setValue(10);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentScreen]);

  // Lắng nghe nút quay lại phần cứng trên Android & vuốt cử chỉ (Point 15)
  useEffect(() => {
    const onBackPress = () => {
      return goBack();
    };

    const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandlerSub.remove();
  }, [currentScreen]);

  // Nạp cookie đã lưu từ AsyncStorage khi mở app và kiểm tra ngay các task đến hạn
  useEffect(() => {
    AsyncStorage.getItem(COOKIE_STORAGE_KEY).then((saved) => {
      if (saved && saved.trim()) {
        setCookieStr(saved);
        setCurrentScreen('HOME');
        updateHistory(['HOME']);
        scheduleWorker.checkAndExecutePendingTasks(saved);
      } else {
        scheduleWorker.checkAndExecutePendingTasks(cookieStr);
      }
    });

    // Lắng nghe khi người dùng chuyển trạng thái app (active / background)
    // Tối ưu pin: Tắt Worker timer và gỡ WebView ngầm khi ẩn app xuống nền
    const sub = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      setIsAppActive(active);

      if (active) {
        scheduleWorker.startWorker();
        scheduleWorker.checkAndExecutePendingTasks();
      } else {
        // Tạm dừng timer JS khi app xuống background
        // Android AlarmManager + HeadlessJS chịu trách nhiệm chạy ngầm đúng giờ
        scheduleWorker.stopWorker();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // Xử lý khi WebView ngầm tự động cập nhật token mới
  const handleTokenUpdated = (newCookies) => {
    setCookieStr(newCookies);
    AsyncStorage.setItem(COOKIE_STORAGE_KEY, newCookies).catch(() => {});
    scheduleWorker.updateAllPendingCookies(newCookies);
  };

  // Xử lý đăng nhập thành công từ WebView
  const handleLoginSuccess = (newCookies) => {
    clearConversationCache();
    setCookieStr(newCookies);
    AsyncStorage.setItem(COOKIE_STORAGE_KEY, newCookies).catch(() => {});
    scheduleWorker.updateAllPendingCookies(newCookies);
    setCurrentScreen('HOME');
    updateHistory(['HOME']);
  };

  // Đổi tài khoản / Đăng xuất hoàn toàn
  const handleLogout = () => {
    clearConversationCache();
    setCookieStr('');
    AsyncStorage.removeItem(COOKIE_STORAGE_KEY).catch(() => {});
    setSelectedConversation(null);
    setSessionKey((prev) => prev + 1);
    setCurrentScreen('LOGIN');
    updateHistory(['LOGIN']);
  };

  // Chọn 1 cuộc trò chuyện
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setCurrentScreen('CHAT_DETAIL');
  };

  // Quay lại danh sách trò chuyện
  const handleBackToConversations = () => {
    setSelectedConversation(null);
    navigateTo('CONVERSATIONS');
  };

  // Chuyển tới màn hình Cài đặt
  const handleOpenSettings = () => {
    navigateTo('SETTINGS');
  };

  // Mở trình tải video với link truyền sẵn từ Home
  const handleOpenDownloaderWithUrl = (url) => {
    setDownloaderInitialUrl(url);
    navigateTo('DOWNLOADER');
  };

  // Đảm bảo khoảng cách an toàn cho Dynamic Island / Camera tai thỏ và Navigation Bar bên dưới
  const safeTop = Platform.OS === 'android' ? Math.max(RNStatusBar.currentHeight || 0, 38) + 10 : 12;
  const safeBottom = Platform.OS === 'android' ? (currentScreen === 'CHAT_DETAIL' ? 18 : 6) : 10;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg, paddingTop: safeTop, paddingBottom: safeBottom }]}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />

      {currentScreen === 'LOGIN' && (
        <LoginWebViewScreen
          key={`login_${sessionKey}`}
          isFreshLogout={sessionKey > 0}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* 1. Màn hình Trung tâm Hub (HOME) */}
      {cookieStr && currentScreen === 'HOME' && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <HomeScreen
            cookieStr={cookieStr}
            onNavigate={(screen) => navigateTo(screen)}
            onOpenDownloaderWithUrl={handleOpenDownloaderWithUrl}
            onLogout={handleLogout}
          />
        </Animated.View>
      )}

      {/* 2. Màn hình Hộp thư & Giữ chuỗi (Giữ mounted để không bị refetch liên tục) */}
      {cookieStr ? (
        <Animated.View
          style={[
            styles.screenContainer,
            currentScreen !== 'CONVERSATIONS' && styles.hidden,
            currentScreen === 'CONVERSATIONS' && { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] },
          ]}
        >
          <ConversationListScreen
            cookieStr={cookieStr}
            onSelectConversation={handleSelectConversation}
            onOpenSettings={handleOpenSettings}
            onLogout={handleLogout}
            onBack={() => goBack()}
          />
        </Animated.View>
      ) : null}

      {/* 3. Màn hình Chi tiết Chat */}
      {currentScreen === 'CHAT_DETAIL' && selectedConversation && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <ChatDetailScreen
            conversation={selectedConversation}
            cookieStr={cookieStr}
            onBack={handleBackToConversations}
          />
        </Animated.View>
      )}

      {/* 4. Màn hình Tải Video TikTok Không Logo */}
      {cookieStr && currentScreen === 'DOWNLOADER' && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <VideoDownloaderScreen
            onBack={() => goBack()}
            onOpenSettings={handleOpenSettings}
            initialUrl={downloaderInitialUrl}
          />
        </Animated.View>
      )}

      {/* 5. Màn hình Cài đặt */}
      {cookieStr && currentScreen === 'SETTINGS' && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <SettingsScreen
            cookieStr={cookieStr}
            onBack={() => goBack()}
            onLogout={handleLogout}
          />
        </Animated.View>
      )}

      {/* Thanh Điều Hướng Đáy (Bottom Navigation Bar) xuất hiện ở 4 tab chính */}
      {cookieStr && currentScreen !== 'LOGIN' && currentScreen !== 'CHAT_DETAIL' && (
        <BottomNavBar
          activeTab={['HOME', 'CONVERSATIONS', 'DOWNLOADER', 'SETTINGS'].includes(currentScreen) ? currentScreen : 'HOME'}
          onSelectTab={(tabId) => navigateTo(tabId)}
        />
      )}

      {/* Background Token Refresher: Chỉ nạp khi app ở Foreground (tiết kiệm 100% RAM & socket ngầm khi ẩn app) */}
      {isAppActive && cookieStr && currentScreen !== 'LOGIN' ? (
        <BackgroundTokenRefresher
          enabled={true}
          onTokenUpdated={handleTokenUpdated}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenContainer: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
