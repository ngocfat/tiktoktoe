/**
 * Direct TikTok Video Extraction & Download Service (100% In-House TikTokToe Engine)
 * Supports: Shortened links (vt.tiktok.com) and direct canonical links (tiktok.com/@user/video/...)
 * Utilizes standalone Web SSR Rehydration Parsing + Native OkHttp Streaming
 * Does not depend on third-party video downloading APIs or wrappers.
 * Integrated with real-time subsystem debug logging for Dev Mode diagnostics.
 */
import { nativeBackgroundService } from './nativeBackgroundService';
import { debugLogger } from './debugLoggerService';

/**
 * Extracts and normalizes TikTok URL from arbitrary text input
 * Supports pasted chat snippets, missing https:// prefixes, and standalone short codes (e.g. ZSgB2GPNS)
 */
export function extractUrlFromText(text) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();

  // 1. Matches standard http:// or https:// URLs
  const match = trimmed.match(/(https?:\/\/[^\s]+)/i);
  if (match) return match[1].trim();

  // 2. Matches standalone short code
  if (/^[a-zA-Z0-9_-]{8,15}$/.test(trimmed)) {
    debugLogger.addLog('VIDEO_EXTRACT', 'info', `Detected shortcode '${trimmed}', prepending https://vt.tiktok.com/`);
    return `https://vt.tiktok.com/${trimmed}/`;
  }

  // 3. Matches domain without https:// prefix
  if (/^(vt\.tiktok\.com|vm\.tiktok\.com|www\.tiktok\.com|tiktok\.com)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

/**
 * Extracts numeric Aweme item ID from URL
 */
export function extractAwemeIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/video\/(\d+)/) || url.match(/item_id=(\d+)/) || url.match(/\/(\d{15,22})/);
  return match ? match[1] : null;
}

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';

/**
 * Resolves HTTP redirect chain for shortened URLs (vt.tiktok.com / vm.tiktok.com / tiktok.com/t/...)
 */
export async function resolveTikTokUrl(rawUrl) {
  const targetUrl = extractUrlFromText(rawUrl);
  if (!targetUrl) throw new Error('Please enter a valid TikTok URL');

  debugLogger.addLog('VIDEO_EXTRACT', 'info', `Resolving URL: ${targetUrl}`);

  // Direct video URL check
  const directId = extractAwemeIdFromUrl(targetUrl);
  if (directId && targetUrl.includes('/video/')) {
    debugLogger.addLog('VIDEO_EXTRACT', 'success', `Direct canonical URL detected, Aweme ID: ${directId}`);
    return {
      fullUrl: targetUrl,
      awemeId: directId,
      isDirect: true,
    };
  }

  // Shortened link: follow HTTP redirect chain with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 9000);
  const startTime = Date.now();

  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
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
      `Redirect resolved (${elapsed}ms): ${finalUrl.slice(0, 60)}...`,
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
      `Redirect resolution error or timeout (${elapsed}ms): ${err.message}`,
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
 * Extracts video stream URLs directly from TikTok HTML SSR rehydration payload
 */
async function fetchFromWebHtml(fullUrl, awemeId) {
  const requestUrl = fullUrl && fullUrl.includes('/video/')
    ? fullUrl
    : `https://www.tiktok.com/@a/video/${awemeId}`;

  debugLogger.addLog('VIDEO_EXTRACT', 'info', `Sending GET request for Web HTML: ${requestUrl}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const startTime = Date.now();

  try {
    const res = await fetch(requestUrl, {
      method: 'GET',
      headers: {
        'User-Agent': MOBILE_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - startTime;
    if (!res.ok) {
      debugLogger.addLog('VIDEO_EXTRACT', 'error', `TikTok server responded with HTTP ${res.status} (${elapsed}ms)`);
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
      `HTML received (${elapsed}ms): size ${html.length} bytes, cookies: ${cookies ? 'Present' : 'None'}`
    );

    // 1. Parse official TikTok SSR Universal Data JSON rehydration block
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
            `Successfully parsed from Rehydration JSON: "${(item.desc || '').slice(0, 40)}..."`,
            {
              id: item.id,
              author: item.author?.nickname,
              hasPlayAddr: Boolean(finalPlayAddr),
              imagesCount: images.length,
            }
          );

          return {
            id: item.id || awemeId,
            title: item.desc || 'TikTok Video',
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
            musicTitle: item.music?.title || 'Original Audio',
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
            engine: 'Direct SSR Rehydration',
          };
        }
      } catch (jsonErr) {
        debugLogger.addLog('VIDEO_EXTRACT', 'warn', `Rehydration JSON parse error: ${jsonErr.message}`);
      }
    }

    // 2. Fallback tier: Regex scan of raw HTML payload for playAddr
    debugLogger.addLog('VIDEO_EXTRACT', 'warn', 'Rehydration tag not found, falling back to raw HTML regex scan...');
    const rawPlayAddrMatch = html.match(/"playAddr":"([^"]+)"/);
    if (rawPlayAddrMatch) {
      let playAddr = rawPlayAddrMatch[1];
      try {
        playAddr = JSON.parse(`"${playAddr}"`);
      } catch (_) {
        playAddr = playAddr.replace(/\\u002F/g, '/').replace(/\\u0026/g, '&').replace(/\\/g, '');
      }

      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' | TikTok', '') : 'TikTok Video';

      debugLogger.addLog('VIDEO_EXTRACT', 'success', `Found playAddr via regex scan: ${title}`);

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
        musicTitle: 'Original Audio',
        stats: { likes: 0, shares: 0, comments: 0, views: 0 },
        images: [],
        isImageAlbum: false,
        pageUrl: requestUrl,
        originalUrl: fullUrl,
        cookies,
        engine: 'Internal Regex Scan',
      };
    }

    debugLogger.addLog('VIDEO_EXTRACT', 'error', 'No media stream found in HTML (possible captcha or private video)');
    return null;
  } catch (err) {
    clearTimeout(timeoutId);
    debugLogger.addLog('VIDEO_EXTRACT', 'error', `Exception fetching Web HTML: ${err.message}`);
    return null;
  }
}

/**
 * Primary media extraction entry point
 */
export async function extractTikTokMedia(inputUrl) {
  debugLogger.addLog('VIDEO_EXTRACT', 'info', `=== STARTING EXTRACTION FOR: "${inputUrl}" ===`);

  // 1. Resolve redirect for shortened and canonical links
  const { fullUrl, awemeId } = await resolveTikTokUrl(inputUrl);

  // 2. Extract media from Web SSR rehydration payload
  const mediaData = await fetchFromWebHtml(fullUrl, awemeId);
  if (mediaData && (mediaData.videoUrl || mediaData.isImageAlbum)) {
    return mediaData;
  }

  debugLogger.addLog('VIDEO_EXTRACT', 'error', 'Extraction finished with error: Unable to locate stream.');
  throw new Error('Unable to extract video information. Please check link validity or network connection.');
}

/**
 * Downloads video file via Native OkHttp streaming engine
 */
export async function downloadVideoToDevice(mediaData, isHd = true) {
  const url = isHd && mediaData.videoUrl ? mediaData.videoUrl : (mediaData.videoSdUrl || mediaData.videoUrl);
  if (!url) throw new Error('Video download URL not found');

  const cleanTitle = (mediaData.title || 'TikTokToe')
    .slice(0, 30)
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  const fileName = `TikTok_${cleanTitle}_${Date.now()}.mp4`;

  debugLogger.addLog('VIDEO_DOWNLOAD', 'info', `Dispatching video download: ${fileName}`);

  return await nativeBackgroundService.downloadMediaWithProgress(
    url,
    mediaData.pageUrl || mediaData.originalUrl,
    fileName,
    `Downloading video: ${cleanTitle}`,
    'video/mp4',
    mediaData.cookies || ''
  );
}

/**
 * Downloads audio MP3 via Native OkHttp streaming engine
 */
export async function downloadAudioToDevice(mediaData) {
  const url = mediaData.audioUrl;
  if (!url) throw new Error('No isolated audio soundtrack found for this video');

  const cleanTitle = (mediaData.musicTitle || mediaData.title || 'TikTokToe_Audio')
    .slice(0, 30)
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();
  const fileName = `Audio_${cleanTitle}_${Date.now()}.mp3`;

  debugLogger.addLog('VIDEO_DOWNLOAD', 'info', `Dispatching audio download: ${fileName}`);

  return await nativeBackgroundService.downloadMediaWithProgress(
    url,
    mediaData.pageUrl || mediaData.originalUrl,
    fileName,
    `Downloading audio: ${cleanTitle}`,
    'audio/mpeg',
    mediaData.cookies || ''
  );
}
