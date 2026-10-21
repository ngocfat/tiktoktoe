import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ToastAndroid,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import {
  extractTikTokMedia,
  downloadVideoToDevice,
  downloadAudioToDevice,
} from '../services/tiktokDownloaderService';
import { nativeBackgroundService } from '../services/nativeBackgroundService';
import { debugLogger } from '../services/debugLoggerService';

export default function VideoDownloaderScreen({ onBack, onOpenSettings }) {
  const { theme, isDarkMode, toggleTheme } = useTheme();

  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [downloadingVideo, setDownloadingVideo] = useState(false);
  const [downloadingAudio, setDownloadingAudio] = useState(false);
  const [mediaData, setMediaData] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(null);

  // Dev Mode & Real-time Logs
  const [isDevMode, setIsDevMode] = useState(debugLogger.isDevModeEnabled());
  const [devLogs, setDevLogs] = useState(debugLogger.getLogs());
  const [showLogsCard, setShowLogsCard] = useState(true);

  // Listen to Dev Mode state and realtime logs
  useEffect(() => {
    const unsub = debugLogger.subscribe((enabled, logs) => {
      setIsDevMode(enabled);
      setDevLogs(logs);
    });
    return () => unsub();
  }, []);

  // Listen to download progress from Native Module in real-time (0% - 100%)
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('onDownloadProgress', (data) => {
      if (data.status === 'completed') {
        setDownloadProgress({ ...data, percent: 100 });
        showToast('Tải thành công! Đã lưu vào mục Tải về & Thư viện ảnh.');
        setTimeout(() => {
          setDownloadProgress(null);
          setDownloadingVideo(false);
          setDownloadingAudio(false);
        }, 2000);
      } else if (data.status === 'failed') {
        setDownloadProgress(null);
        setDownloadingVideo(false);
        setDownloadingAudio(false);
        Alert.alert('Lỗi tải tệp', 'Không thể hoàn tất tải xuống từ TikTok. Vui lòng thử lại!');
      } else {
        setDownloadProgress(data);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const showToast = (msg) => {
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Thông báo', msg);
    }
  };

  // Quick paste link from Clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await nativeBackgroundService.getClipboardText();
      if (text && text.trim()) {
        setInputUrl(text.trim());
        showToast('Đã dán từ bộ nhớ tạm!');
      } else {
        showToast('Bộ nhớ tạm đang trống!');
      }
    } catch (_) {
      showToast('Không thể đọc bộ nhớ tạm.');
    }
  };

  // Clear input field
  const handleClear = () => {
    setInputUrl('');
    setMediaData(null);
    setStatusMessage('');
  };

  // Fetch video metadata from link
  const handleExtract = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('Lỗi', 'Vui lòng nhập hoặc dán link TikTok cần tải!');
      return;
    }

    setLoading(true);
    setStatusMessage('Đang phân tích link và lấy video gốc...');
    setMediaData(null);

    try {
      const data = await extractTikTokMedia(inputUrl.trim());
      setMediaData(data);
      setStatusMessage('');
      showToast('Đã tìm thấy video!');
    } catch (err) {
      setStatusMessage('');
      Alert.alert('Không thể lấy video', err.message || 'Link không hợp lệ hoặc video bị ẩn/xóa.');
    } finally {
      setLoading(false);
    }
  };

  // Download HD video without watermark
  const handleDownloadVideo = async (isHd = true) => {
    if (!mediaData) return;
    setDownloadingVideo(true);
    setDownloadProgress({ percent: 0, bytesRead: 0, totalBytes: 0, status: 'downloading' });

    try {
      showToast('Bắt đầu tải video...');
      await downloadVideoToDevice(mediaData, isHd);
    } catch (err) {
      setDownloadingVideo(false);
      setDownloadProgress(null);
      Alert.alert('Lỗi tải video', err.message || 'Không thể bắt đầu tải xuống.');
    }
  };

  // Download MP3 audio track
  const handleDownloadAudio = async () => {
    if (!mediaData || !mediaData.audioUrl) {
      showToast('Video này không có đường dẫn âm thanh tách riêng.');
      return;
    }
    setDownloadingAudio(true);
    setDownloadProgress({ percent: 0, bytesRead: 0, totalBytes: 0, status: 'downloading' });

    try {
      showToast('Bắt đầu tải nhạc nền MP3...');
      await downloadAudioToDevice(mediaData);
    } catch (err) {
      setDownloadingAudio(false);
      setDownloadProgress(null);
      Alert.alert('Lỗi tải âm thanh', err.message || 'Không thể bắt đầu tải xuống.');
    }
  };

  // Copy logs to clipboard
  const handleCopyLogs = async () => {
    if (devLogs.length === 0) {
      showToast('Chưa có log nào để sao chép.');
      return;
    }
    const logText = devLogs
      .map(
        (l) =>
          `[${l.timestamp}][${l.module}][${l.level.toUpperCase()}] ${l.message}${
            l.details ? '\n' + l.details : ''
          }`
      )
      .join('\n');
    await nativeBackgroundService.setClipboardText(logText);
    showToast('Đã sao chép toàn bộ nhật ký Debug!');
  };

  // Clear logs
  const handleClearLogs = () => {
    debugLogger.clearLogs();
    showToast('Đã làm sạch nhật ký.');
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return String(num);
  };

  const formatSeconds = (sec) => {
    if (!sec) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.bg, borderBottomColor: theme.divider }]}>
        <View style={styles.headerLeft}>
          {onBack && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color={theme.iconColor} />
            </TouchableOpacity>
          )}
          <Ionicons name="cloud-download" size={22} color={theme.tiktokRed} style={{ marginRight: 8 }} />
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Tải Video TikTok</Text>
              {isDevMode && (
                <View style={styles.devModeHeaderBadge}>
                  <Text style={styles.devModeHeaderBadgeText}>DEV</Text>
                </View>
              )}
            </View>
            <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Không watermark • Tải MP4 HD & MP3</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: theme.surface }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isDarkMode ? 'sunny-outline' : 'moon'}
              size={18}
              color={isDarkMode ? '#F59E0B' : '#8B5CF6'}
            />
          </TouchableOpacity>
          {onOpenSettings && (
            <TouchableOpacity
              style={[styles.headerIconBtn, { backgroundColor: theme.surface }]}
              onPress={onOpenSettings}
              activeOpacity={0.7}
            >
              <Ionicons name="settings-outline" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={{ paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
        {/* Debug API Log Terminal (Dev Mode Console) */}
        {isDevMode && (
          <View style={[styles.debugConsoleCard, { backgroundColor: isDarkMode ? '#0F172A' : '#1E293B' }]}>
            <TouchableOpacity
              style={styles.debugConsoleHeader}
              onPress={() => setShowLogsCard(!showLogsCard)}
              activeOpacity={0.8}
            >
              <View style={styles.debugHeaderLeft}>
                <Ionicons name="terminal" size={15} color="#38BDF8" style={{ marginRight: 6 }} />
                <Text style={styles.debugHeaderTitle}>Nhật Ký Debug API</Text>
                <View style={styles.debugCountBadge}>
                  <Text style={styles.debugCountText}>{devLogs.length}</Text>
                </View>
              </View>

              <View style={styles.debugHeaderRight}>
                <TouchableOpacity onPress={handleCopyLogs} style={styles.debugActionBtn}>
                  <Ionicons name="copy-outline" size={13} color="#38BDF8" style={{ marginRight: 3 }} />
                  <Text style={styles.debugActionText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleClearLogs} style={styles.debugActionBtn}>
                  <Ionicons name="trash-outline" size={13} color="#EF4444" style={{ marginRight: 3 }} />
                  <Text style={[styles.debugActionText, { color: '#EF4444' }]}>Xóa</Text>
                </TouchableOpacity>

                <Ionicons
                  name={showLogsCard ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color="#94A3B8"
                  style={{ marginLeft: 4 }}
                />
              </View>
            </TouchableOpacity>

            {showLogsCard && (
              <ScrollView
                style={styles.debugLogScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                {devLogs.length === 0 ? (
                  <Text style={styles.debugEmptyText}>
                    Chưa có log API. Hãy dán link và bấm "Lấy Video" để xem log chi tiết realtime!
                  </Text>
                ) : (
                  devLogs.slice(0, 35).map((item, index) => {
                    const levelColor =
                      item.level === 'error'
                        ? '#EF4444'
                        : item.level === 'warn'
                        ? '#F59E0B'
                        : item.level === 'success'
                        ? '#10B981'
                        : '#38BDF8';

                    return (
                      <View key={item.id || `log-${index}`} style={styles.debugLogRow}>
                        <View style={styles.debugLogMetaRow}>
                          <Text style={styles.debugLogTime}>{item.timestamp}</Text>
                          <View style={[styles.debugLogLevelBadge, { borderColor: levelColor }]}>
                            <Text style={[styles.debugLogLevelText, { color: levelColor }]}>
                              {item.level.toUpperCase()}
                            </Text>
                          </View>
                          <Text style={styles.debugLogModule}>[{item.module}]</Text>
                        </View>
                        <Text
                          style={[
                            styles.debugLogMsg,
                            { color: item.level === 'error' ? '#FCA5A5' : '#F1F5F9' },
                          ]}
                        >
                          {item.message}
                        </Text>
                        {item.details ? (
                          <Text style={styles.debugLogDetails}>
                            {typeof item.details === 'object'
                              ? JSON.stringify(item.details, null, 2)
                              : String(item.details)}
                          </Text>
                        ) : null}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        )}

        {/* Link input box */}
        <View style={[styles.inputCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.inputLabel, { color: theme.textPrimary }]}>
            Dán đường link TikTok vào đây:
          </Text>

          <View style={[styles.inputRow, { backgroundColor: theme.inputBg, borderColor: theme.border }]}>
            <TextInput
              style={[styles.textInput, { color: theme.textPrimary }]}
              placeholder="https://vt.tiktok.com/... hoặc tiktok.com/@..."
              placeholderTextColor={theme.textMuted}
              value={inputUrl}
              onChangeText={setInputUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {inputUrl.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={{ padding: 6 }}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Tool buttons: Paste clipboard & Fetch video */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.btnPaste, { backgroundColor: theme.surface }]}
              onPress={handlePasteClipboard}
              activeOpacity={0.7}
            >
              <Ionicons name="clipboard-outline" size={16} color={theme.textPrimary} style={{ marginRight: 6 }} />
              <Text style={[styles.btnPasteText, { color: theme.textPrimary }]}>Dán từ Clipboard</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnExtract, { backgroundColor: loading ? '#9CA3AF' : theme.tiktokRed }]}
              onPress={handleExtract}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
              ) : (
                <Ionicons name="flash" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              )}
              <Text style={styles.btnExtractText}>
                {loading ? 'Đang Tìm Video...' : 'Lấy Video'}
              </Text>
            </TouchableOpacity>
          </View>

          {statusMessage ? (
            <Text style={[styles.statusText, { color: theme.textSecondary }]}>{statusMessage}</Text>
          ) : null}
        </View>

        {/* Preview card */}
        {mediaData && (
          <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Author & Engine tag */}
            <View style={styles.authorHeader}>
              <View style={styles.authorLeft}>
                {mediaData?.author?.avatar ? (
                  <Image source={{ uri: mediaData.author.avatar }} style={styles.authorAvatar} />
                ) : (
                  <View style={[styles.authorAvatar, { backgroundColor: theme.surface, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person" size={20} color={theme.textPrimary} />
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[styles.authorName, { color: theme.textPrimary }]} numberOfLines={1}>
                    {mediaData?.author?.nickname || 'TikTok Creator'}
                  </Text>
                  <Text style={[styles.authorHandle, { color: theme.textSecondary }]} numberOfLines={1}>
                    @{mediaData?.author?.uniqueId || 'tiktok'}
                  </Text>
                </View>
              </View>

              {mediaData?.engine ? (
                <View style={[styles.engineTag, { backgroundColor: theme.surface }]}>
                  <Ionicons name="shield-checkmark" size={12} color="#10B981" style={{ marginRight: 4 }} />
                  <Text style={[styles.engineTagText, { color: theme.textPrimary }]}>{mediaData.engine}</Text>
                </View>
              ) : null}
            </View>

            {/* Video thumbnail & duration */}
            <View style={styles.mediaPreviewWrapper}>
              {mediaData?.cover ? (
                <Image source={{ uri: mediaData.cover }} style={styles.mediaCover} resizeMode="cover" />
              ) : (
                <View style={[styles.mediaCoverPlaceholder, { backgroundColor: theme.surface }]}>
                  <Ionicons name="videocam-outline" size={48} color={theme.textMuted} />
                </View>
              )}

              {mediaData?.duration > 0 && (
                <View style={styles.durationBadge}>
                  <Ionicons name="play" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.durationBadgeText}>{formatSeconds(mediaData.duration)}</Text>
                </View>
              )}

              <View style={styles.noWmBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#10B981" style={{ marginRight: 3 }} />
                <Text style={styles.noWmBadgeText}>No Watermark</Text>
              </View>
            </View>

            {/* Video title */}
            <Text style={[styles.videoTitle, { color: theme.textPrimary }]} numberOfLines={3}>
              {mediaData?.title || 'Không có tiêu đề'}
            </Text>

            {/* Statistics (Likes, Views, Comments, Shares) */}
            <View style={[styles.statsRow, { backgroundColor: theme.surface }]}>
              <View style={styles.statItem}>
                <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatNumber(mediaData?.stats?.views)}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="heart-outline" size={14} color="#EF4444" />
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatNumber(mediaData?.stats?.likes)}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="chatbubble-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatNumber(mediaData?.stats?.comments)}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="share-social-outline" size={14} color={theme.textSecondary} />
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>{formatNumber(mediaData?.stats?.shares)}</Text>
              </View>
            </View>

            {/* Real-time download progress bar */}
            {downloadProgress && (
              <View style={[styles.progressCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <View style={styles.progressHeader}>
                  <View style={styles.progressTitleRow}>
                    <ActivityIndicator size="small" color={theme.tiktokRed} style={{ marginRight: 6 }} />
                    <Text style={[styles.progressTitle, { color: theme.textPrimary }]}>
                      {downloadProgress.status === 'completed'
                        ? 'Đã tải xong 100%'
                        : 'Đang tải về thiết bị...'}
                    </Text>
                  </View>
                  <Text style={[styles.progressPercent, { color: theme.tiktokRed }]}>
                    {Math.round(downloadProgress.percent)}%
                  </Text>
                </View>

                <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? '#374151' : '#E5E7EB' }]}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, Math.max(0, downloadProgress.percent))}%`,
                        backgroundColor: downloadProgress.status === 'completed' ? '#10B981' : theme.tiktokRed,
                      },
                    ]}
                  />
                </View>

                <View style={styles.progressSubRow}>
                  <Text style={[styles.progressSubText, { color: theme.textSecondary }]}>
                    {downloadProgress.totalBytes > 0
                      ? `${(downloadProgress.bytesRead / (1024 * 1024)).toFixed(1)} MB / ${(downloadProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                      : 'Đang kết nối luồng ByteDance...'}
                  </Text>
                  <Text style={[styles.progressSubText, { color: '#10B981' }]}>
                    {downloadProgress.status === 'completed' ? 'Đã lưu Thư viện ảnh' : 'Lưu vào Downloads'}
                  </Text>
                </View>
              </View>
            )}

            {/* Download action buttons */}
            <View style={styles.downloadButtonsGroup}>
              {/* Download video without watermark button */}
              <TouchableOpacity
                style={[styles.btnDownloadPrimary, { backgroundColor: theme.tiktokRed }]}
                onPress={() => handleDownloadVideo(true)}
                disabled={downloadingVideo}
                activeOpacity={0.8}
              >
                {downloadingVideo ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="arrow-down-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <View>
                  <Text style={styles.btnDownloadPrimaryText}>TẢI VIDEO KHÔNG LOGO (HD)</Text>
                  <Text style={styles.btnDownloadPrimarySub}>Lưu thẳng vào Thư viện / Bộ sưu tập</Text>
                </View>
              </TouchableOpacity>

              {/* Download MP3 audio button */}
              {mediaData?.audioUrl ? (
                <TouchableOpacity
                  style={[styles.btnDownloadSecondary, { backgroundColor: theme.surface, borderColor: theme.border }]}
                  onPress={handleDownloadAudio}
                  disabled={downloadingAudio}
                  activeOpacity={0.7}
                >
                  {downloadingAudio ? (
                    <ActivityIndicator size="small" color={theme.textPrimary} style={{ marginRight: 8 }} />
                  ) : (
                    <Ionicons name="musical-notes" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.btnDownloadSecondaryText, { color: theme.textPrimary }]}>
                      TẢI NHẠC NỀN (MP3)
                    </Text>
                    <Text style={[styles.btnDownloadSecondarySub, { color: theme.textSecondary }]} numberOfLines={1}>
                      {mediaData?.musicTitle || 'Âm thanh gốc'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        )}

        {/* Tips card */}
        <View style={[styles.tipsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb-outline" size={18} color="#F59E0B" style={{ marginRight: 6 }} />
            <Text style={[styles.tipsTitle, { color: theme.textPrimary }]}>Hướng Dẫn Nhanh</Text>
          </View>
          <Text style={[styles.tipItem, { color: theme.textSecondary }]}>
            1. Mở app TikTok, bấm nút <Text style={{ fontWeight: 'bold' }}>Chia sẻ</Text> tại video bạn thích.
          </Text>
          <Text style={[styles.tipItem, { color: theme.textSecondary }]}>
            2. Chọn <Text style={{ fontWeight: 'bold' }}>Sao chép liên kết</Text> (Link dạng <Text style={{ color: theme.tiktokRed }}>vt.tiktok.com</Text> hoặc link dài đều được).
          </Text>
          <Text style={[styles.tipItem, { color: theme.textSecondary }]}>
            3. Quay lại đây, bấm <Text style={{ fontWeight: 'bold' }}>"Dán từ Clipboard"</Text> và nhấn nút <Text style={{ fontWeight: 'bold' }}>"Lấy Video"</Text>.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: 10,
    padding: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
    padding: 16,
  },
  inputCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnPaste: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPasteText: {
    fontSize: 13,
    fontWeight: '600',
  },
  btnExtract: {
    flex: 1.3,
    height: 44,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnExtractText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  resultCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  authorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  authorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  authorHandle: {
    fontSize: 12,
    marginTop: 1,
  },
  engineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  engineTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  mediaPreviewWrapper: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
  },
  mediaCover: {
    width: '100%',
    height: '100%',
  },
  mediaCoverPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  durationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  noWmBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noWmBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  videoTitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  downloadButtonsGroup: {
    gap: 10,
  },
  progressCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressSubText: {
    fontSize: 11,
  },
  btnDownloadPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDownloadPrimaryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  btnDownloadPrimarySub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    textAlign: 'center',
  },
  btnDownloadSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnDownloadSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  btnDownloadSecondarySub: {
    fontSize: 11,
    marginTop: 1,
  },
  tipsCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tipItem: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  devModeHeaderBadge: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  devModeHeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  debugConsoleCard: {
    borderRadius: 14,
    marginBottom: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  debugConsoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  debugHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debugHeaderTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  debugCountBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    marginLeft: 6,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  debugCountText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  debugHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debugActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  debugActionText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  debugLogScroll: {
    maxHeight: 200,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  debugEmptyText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 14,
  },
  debugLogRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingVertical: 6,
  },
  debugLogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: 6,
  },
  debugLogTime: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  debugLogLevelBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 0.5,
  },
  debugLogLevelText: {
    fontSize: 9,
    fontWeight: '800',
  },
  debugLogModule: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  debugLogMsg: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  debugLogDetails: {
    color: '#94A3B8',
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
});
