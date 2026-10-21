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

  // Default to HOME hub screen instead of directly into messages
  const [currentScreen, setCurrentScreen] = useState(cookieStr ? 'HOME' : 'LOGIN');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [sessionKey, setSessionKey] = useState(0);
  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  // Track navigation history stack for back-press behavior
  const [navigationHistory, setNavigationHistory] = useState(['HOME']);
  const historyRef = useRef(['HOME']);

  // Initial URL passed into video downloader
  const [downloaderInitialUrl, setDownloaderInitialUrl] = useState('');

  // Smooth transitions for screen and tab changes
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateYAnim = useRef(new Animated.Value(0)).current;

  // Synchronize ref whenever history changes
  const updateHistory = (newHistory) => {
    historyRef.current = newHistory;
    setNavigationHistory(newHistory);
  };

  // State-tracked navigation helper
  const navigateTo = (screenName) => {
    if (screenName === currentScreen) return;

    const prev = historyRef.current;
    // Prevent duplicate entries in history stack
    const newHistory = [...prev.filter((s) => s !== screenName), screenName];
    updateHistory(newHistory);
    setCurrentScreen(screenName);
  };

  // Pop and navigate back in history stack
  const goBack = () => {
    if (currentScreen === 'CHAT_DETAIL') {
      setSelectedConversation(null);
      setCurrentScreen('CONVERSATIONS');
      return true;
    }

    const currentHist = historyRef.current;
    if (currentHist.length > 1) {
      const nextHist = [...currentHist];
      nextHist.pop(); // Remove current screen
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

    return false; // At root HOME screen: allow system back to exit
  };

  // Screen transition animation effect
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

  // Handle Android hardware back button and gestures
  useEffect(() => {
    const onBackPress = () => {
      return goBack();
    };

    const backHandlerSub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandlerSub.remove();
  }, [currentScreen]);

  // Load persisted session from AsyncStorage on launch and trigger pending tasks
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

    // Monitor app state changes (active / background)
    // Battery optimization: pause JS timer when app enters background
    const sub = AppState.addEventListener('change', (nextState) => {
      const active = nextState === 'active';
      setIsAppActive(active);

      if (active) {
        scheduleWorker.startWorker();
        scheduleWorker.checkAndExecutePendingTasks();
      } else {
        // Pause JS timer; Android AlarmManager + HeadlessJS handle background execution
        scheduleWorker.stopWorker();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // Handler for background token refresh events
  const handleTokenUpdated = (newCookies) => {
    setCookieStr(newCookies);
    AsyncStorage.setItem(COOKIE_STORAGE_KEY, newCookies).catch(() => {});
    scheduleWorker.updateAllPendingCookies(newCookies);
  };

  // Handler for successful login from WebView
  const handleLoginSuccess = (newCookies) => {
    clearConversationCache();
    setCookieStr(newCookies);
    AsyncStorage.setItem(COOKIE_STORAGE_KEY, newCookies).catch(() => {});
    scheduleWorker.updateAllPendingCookies(newCookies);
    setCurrentScreen('HOME');
    updateHistory(['HOME']);
  };

  // Sign out and clear cached credentials
  const handleLogout = () => {
    clearConversationCache();
    setCookieStr('');
    AsyncStorage.removeItem(COOKIE_STORAGE_KEY).catch(() => {});
    setSelectedConversation(null);
    setSessionKey((prev) => prev + 1);
    setCurrentScreen('LOGIN');
    updateHistory(['LOGIN']);
  };

  // Select conversation and navigate to detail
  const handleSelectConversation = (conv) => {
    setSelectedConversation(conv);
    setCurrentScreen('CHAT_DETAIL');
  };

  // Return to conversations list
  const handleBackToConversations = () => {
    setSelectedConversation(null);
    navigateTo('CONVERSATIONS');
  };

  // Navigate to settings screen
  const handleOpenSettings = () => {
    navigateTo('SETTINGS');
  };

  // Navigate to video downloader with prefilled URL
  const handleOpenDownloaderWithUrl = (url) => {
    setDownloaderInitialUrl(url);
    navigateTo('DOWNLOADER');
  };

  // Safe area insets for notches, status bar, and bottom navigation
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

      {/* 1. Home Hub screen */}
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

      {/* 2. Inbox & streak list (kept mounted to prevent redundant refetches) */}
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

      {/* 3. Chat Detail screen */}
      {currentScreen === 'CHAT_DETAIL' && selectedConversation && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <ChatDetailScreen
            conversation={selectedConversation}
            cookieStr={cookieStr}
            onBack={handleBackToConversations}
          />
        </Animated.View>
      )}

      {/* 4. Video Downloader screen */}
      {cookieStr && currentScreen === 'DOWNLOADER' && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <VideoDownloaderScreen
            onBack={() => goBack()}
            onOpenSettings={handleOpenSettings}
            initialUrl={downloaderInitialUrl}
          />
        </Animated.View>
      )}

      {/* 5. Settings screen */}
      {cookieStr && currentScreen === 'SETTINGS' && (
        <Animated.View style={[styles.screenContainer, { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] }]}>
          <SettingsScreen
            cookieStr={cookieStr}
            onBack={() => goBack()}
            onLogout={handleLogout}
          />
        </Animated.View>
      )}

      {/* Bottom Navigation Bar visible across primary tabs */}
      {cookieStr && currentScreen !== 'LOGIN' && currentScreen !== 'CHAT_DETAIL' && (
        <BottomNavBar
          activeTab={['HOME', 'CONVERSATIONS', 'DOWNLOADER', 'SETTINGS'].includes(currentScreen) ? currentScreen : 'HOME'}
          onSelectTab={(tabId) => navigateTo(tabId)}
        />
      )}

      {/* Background Token Refresher: active only while app is in foreground */}
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
