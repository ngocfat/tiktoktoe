import React, { useRef, useImperativeHandle, forwardRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

/**
 * BackgroundTokenRefresher:
 * Off-screen headless WebView (1x1 px, opacity 0, positioned off-screen)
 * Automatically maintains session heartbeat and periodically refreshes msToken and session cookies
 */
const BackgroundTokenRefresher = forwardRef(function BackgroundTokenRefresher(
  { enabled = true, onTokenUpdated },
  ref
) {
  const webViewRef = useRef(null);
  const lastUpdateRef = useRef(0);

  // Expose reload method for other services to trigger on-demand token renewal
  useImperativeHandle(ref, () => ({
    forceRefreshToken: () => {
      if (webViewRef.current) {
        console.log('[BackgroundTokenRefresher] Reloading off-screen WebView to acquire refreshed tokens...');
        webViewRef.current.reload();
      }
    },
  }));

  // Injected script inside TikTok Web to extract renewed session cookies
  const injectedKeepAliveScript = `
    (function() {
      function checkAndSendCookies() {
        try {
          var cookies = document.cookie || '';
          var href = window.location.href;

          // If redirected to login page, the session is expired
          if (href.indexOf('/login') !== -1) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SESSION_EXPIRED',
              url: href
            }));
            return;
          }

          // If valid session cookies are found, broadcast to React Native
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

      // Initial check 3 seconds after page load
      setTimeout(checkAndSendCookies, 3000);

      // Periodic check every 5 minutes (300,000 ms)
      setInterval(checkAndSendCookies, 5 * 60 * 1000);
    })();
    true;
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'TOKEN_REFRESHED' && data.cookies) {
        const now = Date.now();
        // Throttle updates to at least 30 seconds apart to prevent excessive re-renders
        if (now - lastUpdateRef.current > 30000) {
          lastUpdateRef.current = now;
          console.log('[BackgroundTokenRefresher] Refreshed cookies received from background WebView');
          if (onTokenUpdated) {
            onTokenUpdated(data.cookies);
          }
        }
      } else if (data.type === 'SESSION_EXPIRED') {
        console.warn('[BackgroundTokenRefresher] TikTok session expired, re-authentication required.');
      }
    } catch (e) {
      // Ignore JSON parse errors
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
