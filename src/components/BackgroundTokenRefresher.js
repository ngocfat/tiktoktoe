import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * BackgroundTokenRefresher:
 * Chạy ngầm một WebView vô hình (1x1 px, opacity 0, nằm ngoài màn hình)
 * Tự động giữ phiên đăng nhập (heartbeat) và làm mới msToken/session token của TikTok Web định kỳ
 */
const BackgroundTokenRefresher = forwardRef(function BackgroundTokenRefresher(
  { enabled = true, onTokenUpdated },
  ref
) {
  const webViewRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Expose hàm reload để các service khác có thể chủ động kích hoạt làm mới token
  useImperativeHandle(ref, () => ({
    forceRefreshToken: () => {
      if (webViewRef.current) {
        console.log('[BackgroundTokenRefresher] Đang chủ động kích hoạt reload WebView ngầm để lấy token mới...');
        webViewRef.current.reload();
      }
    },
  }));

  // Script chạy ngầm bên trong TikTok Web để trích xuất cookie đã được làm mới
  const injectedKeepAliveScript = `
    (function() {
      function checkAndSendCookies() {
        try {
          var cookies = document.cookie || '';
          var href = window.location.href;

          // Nếu đang ở trang đăng nhập -> session đã bị thu hồi hoàn toàn
          if (href.indexOf('/login') !== -1) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSION_EXPIRED',
              url: href
            }));
            return;
          }

          // Nếu có sessionid và cookie hợp lệ, gửi về cho app cập nhật
          if (cookies && (cookies.indexOf('sessionid=') !== -1 || cookies.indexOf('sid_tt=') !== -1)) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TOKEN_REFRESHED',
              cookies: cookies,
              url: href,
              timestamp: Date.now()
            }));
          }
        } catch (err) {}
      }

      // Gửi sau khi trang tải xong 3 giây
      setTimeout(checkAndSendCookies, 3000);

      // Tự động kiểm tra lại định kỳ mỗi 5 phút (300.000 ms)
      setInterval(checkAndSendCookies, 5 * 60 * 1000);
    })();
    true;
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'TOKEN_REFRESHED' && data.cookies) {
        const now = Date.now();
        // Giới hạn tần suất cập nhật tối thiểu 30 giây để tránh re-render liên tục
        if (now - lastUpdateRef.current > 30000) {
          lastUpdateRef.current = now;
          console.log('[BackgroundTokenRefresher] Đã nhận được cookies mới từ WebView ngầm!');
          if (onTokenUpdated) {
            onTokenUpdated(data.cookies);
          }
        }
      } else if (data.type === 'SESSION_EXPIRED') {
        console.warn('[BackgroundTokenRefresher] Phiên TikTok đã hết hạn hoàn toàn, cần đăng nhập lại.');
      }
    } catch (e) {
      // Bỏ qua lỗi parse JSON không mong muốn
    }
  };

  if (!enabled) return null;

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://www.tiktok.com/messages' }}
        injectedJavaScript={injectedKeepAliveScript}
        onMessage={handleMessage}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        cacheEnabled={true}
        androidLayerType="software"
        mediaPlaybackRequiresUserAction={true}
        allowsInlineMediaPlayback={false}
        userAgent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      />
    </View>
  );
});

export default BackgroundTokenRefresher;

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    left: -9999,
    top: -9999,
    overflow: 'hidden',
  },
});
