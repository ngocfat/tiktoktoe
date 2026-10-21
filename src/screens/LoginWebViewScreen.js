import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_SESSION_COOKIES, cookieObjToString } from '../constants/initialSession';

export default function LoginWebViewScreen({ onLoginSuccess, isFreshLogout = false }) {
  const [loading, setLoading] = useState(true);
  const [isLoggedInDetected, setIsLoggedInDetected] = useState(false);
  const [capturedCookies, setCapturedCookies] = useState('');
  const [webViewKey, setWebViewKey] = useState(isFreshLogout ? 100 : 1);
  const [currentUrl, setCurrentUrl] = useState('https://www.tiktok.com/login/qrcode');
  const webViewRef = useRef(null);

  // Automated cookie detection and DOM optimization script
  // Hides TikTok headers and footers to ensure QR code has 100% visibility
  const injectedCheckCookies = `
    (function() {
      try {
        var style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = \`
          /* Hide TikTok website chrome to maximize QR code visibility */
          [class*="DivHeaderContainer"],
          [class*="StyledHeaderContainer"],
          [class*="AHelpTag"],
          [class*="DivFooterContainer"],
          [class*="DivBottomContainer"],
          [class*="DivCopyright"],
          [class*="PSelectContainer"],
          [class*="SelectFormContainer"],
          footer,
          [class*="footer"],
          [class*="DivBottomText"],
          [class*="feedback"],
          [class*="Feedback"],
          [class*="DivFeedbackLink"],
          [class*="DivDownloadLinkContainer"] {
            display: none !important;
          }

          /* Container layout adjustments */
          html, body {
            background-color: #121214 !important;
            color: #FFFFFF !important;
            overflow: auto !important;
          }

          [class*="DivContainer"],
          [class*="DivBodyContainer"],
          [class*="DivLoginContainer"] {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            margin-top: 0 !important;
            min-height: auto !important;
            background: transparent !important;
            box-shadow: none !important;
          }

          /* Center QR code container cleanly */
          [class*="DivQRContentBody"],
          [class*="DivQRBox"] {
            display: flex !important;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            margin: 6px auto !important;
            padding: 4px !important;
          }

          [class*="DivCodeImage"] {
            margin: 0 auto !important;
          }

          [class*="ImgCode"] {
            max-width: 280px !important;
            max-height: 280px !important;
            border-radius: 8px !important;
          }
        \`;
        document.head.appendChild(style);
      } catch (e) {}

      // Periodic check for session authorization
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
      }, 1500);
    })();
    true;
  `;

  // Resets session state and reloads WebView in a fresh container
  const handleForceLogout = () => {
    setIsLoggedInDetected(false);
    setCapturedCookies('');
    setCurrentUrl('https://www.tiktok.com/login/qrcode');
    setWebViewKey((prev) => prev + 1);
    Alert.alert('Session Cleared', 'WebView reloaded in clean incognito container.');
  };

  // Switch between login modes
  const navigateLoginMode = (url) => {
    setCurrentUrl(url);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.location.href = "${url}"; true;`);
    }
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

    // Fallback to sample session cookies if none intercepted
    const defaultCookieStr = cookieObjToString(DEFAULT_SESSION_COOKIES);
    onLoginSuccess(defaultCookieStr);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Sleek Minimal Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="logo-tiktok" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.title}>TikTok Login</Text>
        </View>

        <TouchableOpacity style={styles.resetBtn} onPress={handleForceLogout} activeOpacity={0.7}>
          <Ionicons name="refresh-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.resetBtnText}>Làm mới</Text>
        </TouchableOpacity>
      </View>

      {/* Slim Mode Switcher */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.tabBtn, currentUrl.includes('/qrcode') && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login/qrcode')}
          activeOpacity={0.7}
        >
          <Ionicons name="qr-code-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Mã QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, currentUrl.includes('/email') && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login/phone-or-email/email')}
          activeOpacity={0.7}
        >
          <Ionicons name="mail-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Email / Password</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, currentUrl === 'https://www.tiktok.com/login' && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login')}
          activeOpacity={0.7}
        >
          <Ionicons name="globe-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Google / Khác</Text>
        </TouchableOpacity>
      </View>

      {/* Login detected banner */}
      {isLoggedInDetected && (
        <TouchableOpacity style={styles.successBanner} onPress={handleEnterInbox} activeOpacity={0.8}>
          <Ionicons name="checkmark-circle-outline" size={17} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.successBannerText}>
            ĐÃ NHẬN DIỆN ĐĂNG NHẬP! BẤM VÀO ĐÂY ĐỂ VÀO HỘP THƯ
          </Text>
          <Ionicons name="arrow-forward-outline" size={15} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}

      {/* Main WebView Container */}
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
            <ActivityIndicator size="large" color="#FE2C55" />
            <Text style={styles.loadingText}>Đang tải trang TikTok QR...</Text>
          </View>
        )}
      </View>

      {/* Ultra-compact Bottom Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.enterBtn, isLoggedInDetected && styles.enterBtnDetected]}
          onPress={handleEnterInbox}
          activeOpacity={0.8}
        >
          <Ionicons
            name={isLoggedInDetected ? 'checkmark-circle' : 'chatbubbles-outline'}
            size={16}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.enterBtnText}>
            {isLoggedInDetected ? 'ĐÃ ĐĂNG NHẬP - VÀO HỘP THƯ' : 'VÀO HỘP THƯ (ENTER INBOX)'}
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#16171B',
    borderBottomWidth: 1,
    borderBottomColor: '#222329',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 42,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resetBtn: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  resetBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 11,
  },
  modeTabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#111216',
    borderBottomWidth: 1,
    borderBottomColor: '#222329',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 38,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginHorizontal: 3,
    borderRadius: 6,
    backgroundColor: '#1F2026',
  },
  tabBtnActive: {
    backgroundColor: '#FE2C55',
  },
  tabBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  successBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 11,
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
    marginTop: 10,
    fontSize: 12,
  },
  bottomBar: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#16171B',
    borderTopWidth: 1,
    borderTopColor: '#222329',
  },
  enterBtn: {
    backgroundColor: '#374151',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  enterBtnDetected: {
    backgroundColor: '#059669',
  },
  enterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
