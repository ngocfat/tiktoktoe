/**
 * Service Phân Tích & Tải Video TikTok Trực Tiếp (100% Nội Bộ TikTokToe)
 * Hỗ trợ: Link rút gọn (vt.tiktok.com) & Link trực tiếp (tiktok.com/@user/video/...)
 * Sử dụng giải pháp thuần tự phát triển: Phân tích Web SSR Rehydration + Native Stream trực tiếp
 * KHÔNG sử dụng bất kỳ API hoặc thư viện tải video của bên thứ ba nào.
 * Tích hợp hệ thống ghi log Debug chi tiết theo yêu cầu Dev Mode.
 */
import { nativeBackgroundService } from './nativeBackgroundService';
import { debugLogger } from './debugLoggerService';

/**
 * Trích xuất và chuẩn hóa URL từ chuỗi văn bản bất kỳ
 * Hỗ trợ cả trường hợp dán nguyên đoạn chat, link thiếu https:// hoặc chỉ dán mã ngắn (ví dụ: ZSgB2GPNS)
 */
export function extractUrlFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();

  // 1. Nếu có chứa http:// hoặc https://
  const match = trimmed.match(/(https?:\/\/[^\s]+)/i);
  if (match) return match[1].trim();

  // 2. Nếu người dùng chỉ nhập mã short code (ví dụ: ZSgB2GPNS)
  if (/^[a-zA-Z0-9_-]{8,15}$/.test(trimmed)) {
    debugLogger.addLog('VIDEO_EXTRACT', 'info', `Phát hiện mã rút gọn '${trimmed}', tự động gán prefix https://vt.tiktok.com/`);
    return `https://vt.tiktok.com/${trimmed}/`;
  }

  // 3. Nếu người dùng nhập link dạng vt.tiktok.com/... hoặc tiktok.com/... mà không có https://
  if (/^(vt\.tiktok\.com|vm\.tiktok\.com|www\.tiktok\.com|tiktok\.com)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Tìm ID video (Aweme ID) từ URL bất kỳ
 */
export function extractAwemeIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/video\/(\d+)/) || url.match(/item_id=(\d+)/) || url.match(/\/(\d{15,22})/);
  return match ? match[1] : null;
}

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

/**
 * Giải mã chuyển hướng link rút gọn (vt.tiktok.com / vm.tiktok.com / tiktok.com/t/...)
 */
export async function resolveTikTokUrl(rawUrl) {
  const targetUrl = extractUrlFromText(rawUrl);
  if (!targetUrl) throw new Error('Vui lòng dán đường link TikTok hợp lệ!');

  debugLogger.addLog('VIDEO_EXTRACT', 'info', `Bắt đầu giải mã URL: ${targetUrl}`);

  // Nếu đã là link trực tiếp có ID video
  const directId = extractAwemeIdFromUrl(targetUrl);
  if (directId && targetUrl.includes('/video/')) {
    debugLogger.addLog('VIDEO_EXTRACT', 'success', `Link trực tiếp hợp lệ, ID video: ${directId}`);
    return {
      fullUrl: targetUrl,
      awemeId: directId,
      isDirect: true,
    };
  }

  // Nếu là link rút gọn -> giải mã chuyển hướng HTTP với timeout kiểm soát
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  const startTime = Date.now();

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;
    const finalUrl = res.url || targetUrl;
    const awemeId = extractAwemeIdFromUrl(finalUrl) || directId;

    debugLogger.addLog(
      'VIDEO_EXTRACT',
      'success',
      `Giải mã redirect thành công (${elapsed}ms): ${finalUrl.slice(0, 60)}...`,
      { status: res.status, finalUrl, awemeId }
    );

    return {
      fullUrl: finalUrl,
      awemeId,
      isDirect: false,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    debugLogger.addLog(
      'VIDEO_EXTRACT',
      'warn',
      `Lỗi hoặc timeout khi giải mã redirect (${elapsed}ms): ${err.message}`,
      { targetUrl }
    );
    return {
      fullUrl: targetUrl,
      awemeId: directId,
      isDirect: false,
    };
  }
}

/**
 * Lấy dữ liệu video trực tiếp từ mã nguồn HTML (Web SSR Rehydration của TikTok)
 */
async function fetchFromWebHtml(fullUrl, awemeId) {
  const requestUrl = fullUrl && fullUrl.includes('/video/')
    ? fullUrl
    : `https://www.tiktok.com/@a/video/${awemeId}`;

  debugLogger.addLog('VIDEO_EXTRACT', 'info', `Gửi GET request tải Web HTML từ: ${requestUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const startTime = Date.now();

  try {
    const res = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;
    if (!res.ok) {
      debugLogger.addLog('VIDEO_EXTRACT', 'error', `Máy chủ TikTok phản hồi HTTP ${res.status} (${elapsed}ms)`);
      return null;
    }

    let cookies = '';
    try {
      if (res.headers.getSetCookie) {
        cookies = res.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
      } else if (res.headers.get('set-cookie')) {
        cookies = res.headers.get('set-cookie').split(';')[0];
      }
    } catch (_) {}

    const html = await res.text();
    debugLogger.addLog(
      'VIDEO_EXTRACT',
      'info',
      `Nhận HTML (${elapsed}ms): độ dài ${html.length} bytes, cookies: ${cookies ? 'Có' : 'Không'}`
    );

    // 1. Phân tích qua thẻ JSON Rehydration chính thống của TikTok (hỗ trợ cả webapp.video-detail & webapp.reflow.video.detail)
    const match =
      html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/) ||
      html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);

    if (match) {
      try {
        const data = JSON.parse(match[1]);
        const defaultScope = data['__DEFAULT_SCOPE__'];
        const videoDetail = defaultScope?.['webapp.video-detail'];
        const reflowDetail = defaultScope?.['webapp.reflow.video.detail'];

        const item =
          videoDetail?.itemInfo?.itemStruct ||
          reflowDetail?.itemInfo?.itemStruct ||
          reflowDetail?.itemStruct;

        if (item && (item.video?.playAddr || item.video?.downloadAddr || item.imagePostInfo)) {
          const images = (item.imagePostInfo?.images || []).map(
            (img) => img.displayImage?.urlList?.[0] || ''
          ).filter(Boolean);

          const finalPlayAddr = item.video?.playAddr || item.video?.downloadAddr || '';

          debugLogger.addLog(
            'VIDEO_EXTRACT',
            'success',
            `Đã trích xuất thành công từ Rehydration JSON! Tiêu đề: "${(item.desc || '').slice(0, 40)}..."`,
            {
              id: item.id,
              author: item.author?.nickname,
              hasPlayAddr: Boolean(finalPlayAddr),
              imagesCount: images.length,
            }
          );

          return {
            id: item.id || awemeId,
            title: item.desc || 'Video TikTok',
            author: {
              nickname: item.author?.nickname || 'TikTok Creator',
              uniqueId: item.author?.uniqueId || item.author?.id || 'tiktok',
              avatar: item.author?.avatarLarger || item.author?.avatarMedium || item.author?.avatarThumb || '',
            },
            cover: item.video?.cover || item.video?.originCover || '',
            duration: item.video?.duration || 0,
            videoUrl: finalPlayAddr,
            videoSdUrl: finalPlayAddr,
            audioUrl: item.music?.playUrl || '',
            musicTitle: item.music?.title || 'Âm thanh gốc',
            stats: {
              likes: item.stats?.diggCount || item.stats?.likes || 0,
              shares: item.stats?.shareCount || item.stats?.shares || 0,
              comments: item.stats?.commentCount || item.stats?.comments || 0,
              views: item.stats?.playCount || item.stats?.views || 0,
            },
            images,
            isImageAlbum: images.length > 0,
            pageUrl: requestUrl,
            originalUrl: fullUrl,
            cookies,
            engine: 'Trích xuất trực tiếp',
          };
        }
      } catch (jsonErr) {
        debugLogger.addLog('VIDEO_EXTRACT', 'warn', `Lỗi phân tích JSON rehydration: ${jsonErr.message}`);
      }
    }

    // 2. Tầng dự phòng nội bộ: Tìm kiếm trực tiếp playAddr qua Regex trong HTML thô
    debugLogger.addLog('VIDEO_EXTRACT', 'warn', 'Không thấy Rehydration tag, kích hoạt quét Regex nội bộ...');
    const rawPlayAddrMatch = html.match(/"playAddr":"([^"]+)"/);
    if (rawPlayAddrMatch) {
      let playAddr = rawPlayAddrMatch[1];
      try {
        playAddr = JSON.parse(`"${playAddr}"`);
      } catch (_) {
        playAddr = playAddr.replace(/\\u002F/g, '/').replace(/\\u0026/g, '&').replace(/\\/g, '');
      }

      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' | TikTok', '') : 'Video TikTok';

      debugLogger.addLog('VIDEO_EXTRACT', 'success', `Tìm thấy link playAddr qua Regex HTML! Tiêu đề: ${title}`);

      return {
        id: awemeId || 'tiktok_video',
        title,
        author: {
          nickname: 'TikTok Creator',
          uniqueId: 'tiktok',
          avatar: '',
        },
        cover: '',
        duration: 0,
        videoUrl: playAddr,
        videoSdUrl: playAddr,
        audioUrl: '',
        musicTitle: 'Âm thanh gốc',
        stats: { likes: 0, shares: 0, comments: 0, views: 0 },
        images: [],
        isImageAlbum: false,
        pageUrl: requestUrl,
        originalUrl: fullUrl,
        cookies,
        engine: 'Quét Regex Nội Bộ',
      };
    }

    debugLogger.addLog('VIDEO_EXTRACT', 'error', 'Không tìm thấy dữ liệu video trong HTML (Có thể trang bị captcha hoặc link riêng tư)');
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    debugLogger.addLog('VIDEO_EXTRACT', 'error', `Ngoại lệ khi tải Web HTML: ${err.message}`);
    return null;
  }
}

/**
 * Hàm phân tích và lấy thông tin video chính cho toàn bộ ứng dụng
 */
export async function extractTikTokMedia(inputUrl) {
  debugLogger.addLog('VIDEO_EXTRACT', 'info', `=== BẮT ĐẦU PHÂN TÍCH LINK: "${inputUrl}" ===`);

  // 1. Resolve redirect cho cả link rút gọn & link trực tiếp
  const { fullUrl, awemeId } = await resolveTikTokUrl(inputUrl);

  // 2. Trích xuất trực tiếp từ Web HTML nội bộ
  const mediaData = await fetchFromWebHtml(fullUrl, awemeId);
  if (mediaData && (mediaData.videoUrl || mediaData.isImageAlbum)) {
    return mediaData;
  }

  debugLogger.addLog('VIDEO_EXTRACT', 'error', `Hoàn tất với lỗi: Không thể tìm thấy luồng video.`);
  throw new Error('Không thể lấy thông tin video. Vui lòng kiểm tra lại liên kết hoặc kết nối mạng!');
}

/**
 * Tải Video về máy bằng Native OkHttp Streaming (Lưu vào Downloads/Gallery)
 */
export async function downloadVideoToDevice(mediaData, isHd = true) {
  const url = isHd && mediaData.videoUrl ? mediaData.videoUrl : (mediaData.videoSdUrl || mediaData.videoUrl);
  if (!url) throw new Error('Không tìm thấy liên kết video để tải!');

  const cleanTitle = (mediaData.title || 'TikTokToe')
    .slice(0, 30)
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  const fileName = `TikTok_${cleanTitle}_${Date.now()}.mp4`;

  debugLogger.addLog('VIDEO_DOWNLOAD', 'info', `Bắt đầu gửi lệnh tải video: ${fileName}`);

  return await nativeBackgroundService.downloadMediaWithProgress(
    url,
    mediaData.pageUrl || mediaData.originalUrl,
    fileName,
    `Tải video: ${cleanTitle}`,
    'video/mp4',
    mediaData.cookies || ''
  );
}

/**
 * Tải Nhạc nền MP3 về máy bằng Native OkHttp Streaming
 */
export async function downloadAudioToDevice(mediaData) {
  const url = mediaData.audioUrl;
  if (!url) throw new Error('Video này không có đường dẫn âm thanh tách riêng!');

  const cleanTitle = (mediaData.musicTitle || mediaData.title || 'TikTokToe_Audio')
    .slice(0, 30)
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  const fileName = `Audio_${cleanTitle}_${Date.now()}.mp3`;

  debugLogger.addLog('VIDEO_DOWNLOAD', 'info', `Bắt đầu gửi lệnh tải âm thanh MP3: ${fileName}`);

  return await nativeBackgroundService.downloadMediaWithProgress(
    url,
    mediaData.pageUrl || mediaData.originalUrl,
    fileName,
    `Tải âm thanh: ${cleanTitle}`,
    'audio/mpeg',
    mediaData.cookies || ''
  );
}
