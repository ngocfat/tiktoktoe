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

  // Load persisted theme preference from AsyncStorage on startup
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
      console.warn('Failed to save theme preference:', e);
    }
  };

  // Compute effective isDarkMode based on current themeMode setting
  let isDarkMode = true;
  if (themeMode === 'SYSTEM') {
    isDarkMode = systemColorScheme !== 'light'; // Default to dark if system is dark or undefined
  } else if (themeMode === 'DARK') {
    isDarkMode = true;
  } else if (themeMode === 'LIGHT') {
    isDarkMode = false;
  }

  const toggleTheme = () => {
    // Quick toggle between Dark and Light mode with persistence
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
