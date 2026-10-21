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

  // Script tự động kiểm tra cookie và trạng thái đăng nhập
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

  // Xóa sạch toàn bộ phiên cũ: hủy WebView cũ và tạo một WebView Incognito mới 100%
  const handleForceLogout = () => {
    setIsLoggedInDetected(false);
    setCapturedCookies('');
    setCurrentUrl('https://www.tiktok.com/login');
    setWebViewKey((prev) => prev + 1);
    Alert.alert('Đã xóa phiên', 'Đã hủy phiên làm việc cũ. WebView đang mở lại ở chế độ ẩn danh hoàn toàn sạch.');
  };

  // Chuyển chế độ đăng nhập trực tiếp (Mã QR hoặc Email/Mật khẩu)
  const navigateLoginMode = (url) => {
    setCurrentUrl(url);
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`window.location.href = "${url}"; true;`);
    }
  };

  // Tính năng: Trích xuất Cookies trực tiếp từ App TikTok thật (qua ADB Bridge Server hoặc Session thật đã lưu)
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
        // Tiếp tục thử URL tiếp theo
      }
    }

    setExtracting(false);

    if (extractedData && extractedData.cookie_string) {
      Alert.alert(
        'Trích Xuất Thành Công',
        `Đã đọc thành công cookies từ App TikTok thật!\n• Nickname: ${extractedData.nickname || 'N/A'}\n• UID: ${extractedData.uid || 'N/A'}\n• Số cookie: ${Object.keys(extractedData.cookies).length}`,
        [
          {
            text: 'Vào Hộp Thư Ngay',
            onPress: () => onLoginSuccess(extractedData.cookie_string),
          },
        ]
      );
      return;
    }

    // Nếu ADB chưa bật máy chủ thì sử dụng Session của App thật đã trích xuất sẵn
    const realCookieStr = getRealAppCookieString();
    Alert.alert(
      'Nạp Session App Thật',
      `Đang nạp bộ Cookies đã trích xuất từ App TikTok thật (RainX - UID: ${REAL_APP_SESSION.uid})!`,
      [
        {
          text: 'Vào Hộp Thư Ngay',
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
      // Bỏ qua lỗi parse
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

    // Sử dụng bộ cookie mặc định nếu chưa bắt được
    const defaultCookieStr = cookieObjToString(DEFAULT_SESSION_COOKIES);
    onLoginSuccess(defaultCookieStr);
  };

  const handleApplyManualCookie = () => {
    if (!manualCookieInput.trim()) {
      Alert.alert('Lỗi', 'Vui lòng dán chuỗi cookie vào ô nhập!');
      return;
    }
    onLoginSuccess(manualCookieInput.trim());
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Điều Khiển */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Ionicons name="logo-tiktok" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.title}>Đăng Nhập TikTok</Text>
          </View>
          <Text style={styles.subtitle}>
            {isLoggedInDetected ? 'Đã phát hiện đăng nhập' : 'Chọn hình thức đăng nhập bên dưới'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleForceLogout}>
            <Ionicons name="trash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.logoutBtnText}>Xóa Nick</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualBtn}
            onPress={() => setShowManualPaste(!showManualPaste)}
          >
            <Ionicons name="clipboard-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.manualBtnText}>Dán Cookie</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Thanh Nút: Trích Xuất Cookies Trực Tiếp Từ App Thật */}
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
            {extracting ? 'Đang đọc dữ liệu App thật...' : 'Trích Xuất Cookies Từ App TikTok Thật'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Thanh Điều Hướng Chế Độ Đăng Nhập Của WebView */}
      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.tabBtn, currentUrl.includes('/qrcode') && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login/qrcode')}
        >
          <Ionicons name="qr-code-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Xem Mã QR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, currentUrl.includes('/email') && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login/phone-or-email/email')}
        >
          <Ionicons name="mail-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Email / Mật Khẩu</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, currentUrl === 'https://www.tiktok.com/login' && styles.tabBtnActive]}
          onPress={() => navigateLoginMode('https://www.tiktok.com/login')}
        >
          <Ionicons name="globe-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={styles.tabBtnText}>Google / Tất Cả</Text>
        </TouchableOpacity>
      </View>

      {/* Hộp Dán Cookie Thủ Công */}
      {showManualPaste && (
        <View style={styles.pasteBox}>
          <Text style={styles.pasteLabel}>Dán chuỗi Cookie từ trình duyệt hoặc app khác:</Text>
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
              <Text style={styles.pasteSubmitText}>Đăng Nhập Bằng Cookie Này</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.pasteQuick}
              onPress={() => onLoginSuccess(cookieObjToString(DEFAULT_SESSION_COOKIES))}
            >
              <Ionicons name="flash-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.pasteQuickText}>Cookie Mẫu</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Banner thông báo khi đã vào được Feed */}
      {isLoggedInDetected && (
        <TouchableOpacity style={styles.successBanner} onPress={handleEnterInbox}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.successBannerText}>
            ĐÃ ĐĂNG NHẬP XONG! BẤM VÀO ĐÂY ĐỂ VÀO HỘP THƯ
          </Text>
          <Ionicons name="arrow-forward-outline" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
        </TouchableOpacity>
      )}

      {/* Cửa Sổ WebView (Chế độ Incognito để không bị nhớ nick cũ) */}
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
            <Text style={styles.loadingText}>Đang tải trang đăng nhập TikTok...</Text>
          </View>
        )}
      </View>

      {/* Thanh điều khiển dưới cùng */}
      <View style={styles.bottomBar}>
        <TouchableOpacity style={styles.enterBtn} onPress={handleEnterInbox}>
          <Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.enterBtnText}>
            {isLoggedInDetected ? 'XÁC NHẬN VÀO HỘP THƯ NGAY' : 'ĐÃ ĐĂNG NHẬP XONG - VÀO CHAT'}
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
    marginTop: 8,
    justifyContent: 'space-between',
  },
  pasteSubmit: {
    backgroundColor: '#FE2C55',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pasteSubmitText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  pasteQuick: {
    backgroundColor: '#262830',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  pasteQuickText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  successBanner: {
    backgroundColor: '#059669',
    flexDirection: 'row',
    paddingVertical: 11,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 0.3,
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
    backgroundColor: 'rgba(15, 15, 18, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 13,
  },
  bottomBar: {
    padding: 12,
    backgroundColor: '#16171B',
    borderTopWidth: 1,
    borderTopColor: '#222329',
  },
  enterBtn: {
    backgroundColor: '#FE2C55',
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enterBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});
