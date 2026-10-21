import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME } from './theme';

const THEME_STORAGE_KEY = 'APP_THEME_PREFERENCE_V1';

const ThemeContext = createContext({
  themeMode: 'SYSTEM',
  setThemeMode: () => {},
  isDarkMode: true,
  toggleTheme: () => {},
  theme: THEME.dark,
});

export function ThemeProvider({ children }) {
  const systemColorScheme = useColorScheme(); // 'dark' | 'light' | null | undefined
  const [themeMode, setThemeModeState] = useState('SYSTEM'); // 'SYSTEM' | 'DARK' | 'LIGHT'

  // Nạp cài đặt theme đã lưu từ AsyncStorage khi khởi động
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved && ['SYSTEM', 'DARK', 'LIGHT'].includes(saved)) {
        setThemeModeState(saved);
      }
    }).catch(() => {});
  }, []);

  const setThemeMode = async (newMode) => {
    setThemeModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (e) {
      console.warn('Lỗi lưu theme:', e);
    }
  };

  // Tính toán isDarkMode thực tế dựa theo themeMode
  let isDarkMode = true;
  if (themeMode === 'SYSTEM') {
    isDarkMode = systemColorScheme !== 'light'; // Mặc định dark nếu hệ thống là dark hoặc không xác định
  } else if (themeMode === 'DARK') {
    isDarkMode = true;
  } else if (themeMode === 'LIGHT') {
    isDarkMode = false;
  }

  const toggleTheme = () => {
    // Chuyển đổi nhanh Dark <-> Light và lưu lại
    const nextMode = isDarkMode ? 'LIGHT' : 'DARK';
    setThemeMode(nextMode);
  };

  const theme = isDarkMode ? THEME.dark : THEME.light;

  return (
    <ThemeContext.Provider value={{ themeMode, setThemeMode, isDarkMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
