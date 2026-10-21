import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  TextInput,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_SESSION_COOKIES, cookieObjToString } from '../constants/initialSession';
import { REAL_APP_SESSION, getRealAppCookieString } from '../constants/realAppSession';

export default function LoginWebViewScreen({ onLoginSuccess, isFreshLogout = false }) {
  const [loading, setLoading] = useState(true);
  const [isLoggedInDetected, setIsLoggedInDetected] = useState(false);
  const [capturedCookies, setCapturedCookies] = useState('');
  const [webViewKey, setWebViewKey] = useState(isFreshLogout ? 100 : 1);
  const [currentUrl, setCurrentUrl] = useState('https://www.tiktok.com/login');
  const [showManualPaste, setShowManualPaste] = useState(false);
  const [manualCookieInput, setManualCookieInput] = useState('');
  const [extracting, setExtracting] = useState(false);
  const webViewRef = useRef(null);

  // Automated cookie detection and login state polling script
  const injectedCheckCookies = `
    (function() {
      var checkTimer = setInterval(function() {
        var cookies = document.cookie || '';
        var onHomeFeed = window.location.href.indexOf('/login') === -1 && 
                         window.location.href.indexOf('/logout') === -1 && 
                         window.location.href.indexOf('tiktok.com') !== -1;

        if (onHomeFeed || cookies.indexOf('passport_fe_beating_status=true') !== -1) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'LOGIN_DETECTED',
            url: window.location.href,
            cookies: cookies
          }));
        }
      }, 2000);
    })();
    true;
  `;

  // Force logout: resets session state and reloads WebView in clean incognito container
  const handleForceLogout = () => {
    setIsLoggedInDetected(false);
    setCapturedCookies('');
    setCurrentUrl('https://www.tiktok.com/login');
    setWebViewKey((prev) => prev + 1);
    Alert.alert('Session Cleared', 'Previous session invalidated. WebView reset to clean incognito container.');
  };

  // Switch between login modes (QR Code, Email/Password, or All/OAuth)
  const navigateLoginMode = (url) => {
    setCurrentUrl(url);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.location.href = "${url}"; true;`);
    }
  };

  // Feature: Extract cookies directly from native TikTok app via ADB Bridge Server or saved session
  const handleExtractFromRealApp = async () => {
    setExtracting(true);
    const bridgeUrls = [
      'http://10.0.2.2:5005/extract-session',
      'http://192.168.1.19:5005/extract-session',
      'http://localhost:5005/extract-session',
    ];

    let extractedData = null;

    for (const url of bridgeUrls) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data && data.cookies && Object.keys(data.cookies).length > 0) {
            extractedData = data;
            break;
          }
        }
      } catch (e) {
        // Continue to next bridge endpoint
      }
    }

    setExtracting(false);

    if (extractedData && extractedData.cookie_string) {
      Alert.alert(
        'Extraction Successful',
        `Successfully extracted cookies from native TikTok app!\n• Nickname: ${extractedData.nickname || 'N/A'}\n• UID: ${extractedData.uid || 'N/A'}\n• Cookie count: ${Object.keys(extractedData.cookies).length}`,
        [
          {
            text: 'Enter Inbox Now',
            onPress: () => onLoginSuccess(extractedData.cookie_string),
          },
        ]
      );
      return;
    }

    // Fallback to pre-extracted native app session if bridge server is offline
    const realCookieStr = getRealAppCookieString();
    Alert.alert(
      'Load Native Session',
      `Loading cookies extracted from native TikTok app (RainX - UID: ${REAL_APP_SESSION.uid})`,
      [
        {
          text: 'Enter Inbox Now',
          onPress: () => onLoginSuccess(realCookieStr),
        },
      ]
    );
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'LOGIN_DETECTED') {
        setIsLoggedInDetected(true);
        if (data.cookies) {
          setCapturedCookies(data.cookies);
        }
      }
    } catch (e) {
      // Ignore JSON parse error
    }
  };

  const handleNavigationChange = (navState) => {
    const url = navState.url || '';
    if (!url.includes('/login') && !url.includes('/logout') && url.includes('tiktok.com')) {
      setIsLoggedInDetected(true);
    }
  };

  const handleEnterInbox = () => {
    if (capturedCookies && capturedCookies.length > 20) {
      onLoginSuccess(capturedCookies);
      return;
    }

    // Fallback to default sample session cookies if none intercepted
    const defaultCookieStr = cookieObjToString(DEFAULT_SESSION_COOKIES);
    onLoginSuccess(defaultCookieStr);
  };

  const handleApplyManualCookie = () => {
    if (!manualCookieInput.trim()) {
      Alert.alert('Error', 'Please paste cookie string into the input field.');
      return;
    }
    onLoginSuccess(manualCookieInput.trim());
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="logo-tiktok" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.title}>TikTok Login</Text>
          </View>
          <Text style={styles.subtitle}>
            {isLoggedInDetected ? 'Login detected' : 'Select login method below'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleForceLogout}>
            <Ionicons name="trash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.logoutBtnText}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => setShowManualPaste(!showManualPaste)}
          >
            <Ionicons name="clipboard-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.manualBtnText}>Paste Cookie</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action bar: Extract cookies from native app */}
      <View style={styles.extractBar}>
        <TouchableOpacity
          style={styles.extractBtn}
          onPress={handleExtractFromRealApp}
          disabled={extracting}
        >
          {extracting ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : (
            <Ionicons name="phone-portrait-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          )}
          <Text style={styles.extractBtnText}>
            {extracting ? 'Reading native app data...' : 'Extract Cookies from Native TikTok App'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* WebView navigation mode tabs */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.tabBtn, currentUrl.includes('/qrcode') && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login/qrcode')}
        >
          <Ionicons name="qr-code-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>QR Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, currentUrl.includes('/email') && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login/phone-or-email/email')}
        >
          <Ionicons name="mail-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Email / Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, currentUrl === 'https://www.tiktok.com/login' && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login')}
        >
          <Ionicons name="globe-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Google / All</Text>
        </TouchableOpacity>
      </View>

      {/* Manual cookie paste box */}
      {showManualPaste && (
        <View style={styles.pasteBox}>
          <Text style={styles.pasteLabel}>Paste cookie string from browser or external session:</Text>
          <TextInput
            style={styles.pasteInput}
            multiline
            placeholder="sessionid=xxx; sid_tt=yyy; multi_sids=zzz..."
            placeholderTextColor="#666"
            value={manualCookieInput}
            onChangeText={setManualCookieInput}
          />
          <View style={styles.pasteActions}>
            <TouchableOpacity style={styles.pasteSubmit} onPress={handleApplyManualCookie}>
              <Ionicons name="checkmark-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.pasteSubmitText}>Apply This Cookie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pasteQuick}
              onPress={() => onLoginSuccess(cookieObjToString(DEFAULT_SESSION_COOKIES))}
            >
              <Ionicons name="flash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.pasteQuickText}>Sample Cookie</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Login detected banner */}
      {isLoggedInDetected && (
        <TouchableOpacity style={styles.successBanner} onPress={handleEnterInbox}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.successBannerText}>
            LOGIN DETECTED! TAP HERE TO ENTER INBOX
          </Text>
          <Ionicons name="arrow-forward-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}

      {/* Incognito WebView container */}
      <View style={styles.webContainer}>
        <WebView
          key={`webview_session_${webViewKey}`}
          ref={webViewRef}
          source={{ uri: currentUrl }}
          injectedJavaScript={injectedCheckCookies}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationChange}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
          incognito={true}
          clearCache={true}
          clearFormData={true}
          cacheEnabled={false}
          style={styles.webview}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={styles.loadingText}>Loading TikTok login page...</Text>
          </View>
        )}
      </View>

      {/* Bottom confirmation bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.enterBtn} onPress={handleEnterInbox}>
          <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.enterBtnText}>
            {isLoggedInDetected ? 'CONFIRM AND ENTER INBOX' : 'ENTER INBOX'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F12',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16171B',
    borderBottomWidth: 1,
    borderBottomColor: '#222329',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#8A8B91',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutBtn: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  logoutBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  manualBtn: {
    backgroundColor: '#262830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  manualBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  extractBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1B1C22',
    borderBottomWidth: 1,
    borderBottomColor: '#262830',
  },
  extractBtn: {
    backgroundColor: '#2A2C35',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#373943',
  },
  extractBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#16171B',
    borderBottomWidth: 1,
    borderBottomColor: '#222329',
    justifyContent: 'space-between',
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#262830',
  },
  tabBtnActive: {
    backgroundColor: '#FE2C55',
  },
  tabBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pasteBox: {
    backgroundColor: '#16171B',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#262830',
  },
  pasteLabel: {
    color: '#E5E7EB',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '600',
  },
  pasteInput: {
    backgroundColor: '#0F0F12',
    borderRadius: 6,
    color: '#FFFFFF',
    padding: 10,
    fontSize: 12,
    height: 55,
    borderWidth: 1,
    borderColor: '#262830',
    textAlignVertical: 'top',
  },
  pasteActions: {
    flexDirection: 'row',
    marginTop: 10,
    justifyContent: 'flex-end',
    gap: 8,
  },
  pasteSubmit: {
    backgroundColor: '#FE2C55',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 6,
  },
  pasteSubmitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  pasteQuick: {
    backgroundColor: '#374151',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  pasteQuickText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  successBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  webContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F0F12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#8A8B91',
    marginTop: 12,
    fontSize: 13,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16171B',
    borderTopWidth: 1,
    borderTopColor: '#222329',
  },
  enterBtn: {
    backgroundColor: '#FE2C55',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
  },
  enterBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
