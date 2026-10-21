/**
 * Standalone TikTok Video Search & Discovery Engine
 * 100% In-House implementation with zero third-party dependencies
 * Queries official TikTok Explore category streams signed with native X-Bogus algorithm
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendXBogusToUrl } from '../utils/signXbogus.js';

export const TIKTOK_EXPLORE_CATEGORIES = [
  {
    id: 104,
    name: 'Comedy',
    label: 'Hai huoc',
    keywords: ['hai', 'haihuoc', 'meme', 'cuoi', 'troll', 'vui', 'funny', 'comedy', 'cliphai', 'haihuocvn'],
  },
  {
    id: 113,
    name: 'Animals',
    label: 'Thu cung',
    keywords: ['meo', 'cho', 'pet', 'cat', 'dog', 'animal', 'thucung', 'cute', 'dethuong', 'cuncung'],
  },
  {
    id: 103,
    name: 'Games',
    label: 'Gaming',
    keywords: ['game', 'gaming', 'lienquan', 'pubg', 'freefire', 'roblox', 'lmht', 'gamer', 'esports', 'lienminh'],
  },
  {
    id: 111,
    name: 'Food',
    label: 'Am thuc',
    keywords: ['amthuc', 'anuong', 'monan', 'nauan', 'food', 'mukbang', 'cooking', 'recipe', 'reviewan'],
  },
  {
    id: 119,
    name: 'Music & Dance',
    label: 'Am nhac',
    keywords: ['nhac', 'baihat', 'casi', 'nhay', 'dance', 'music', 'song', 'idol', 'cover', 'remix', 'trendnhac'],
  },
  {
    id: 100,
    name: 'Anime & Comics',
    label: 'Anime',
    keywords: ['anime', 'manga', 'hoathinh', 'wibu', 'comic', 'cosplay', 'otaku', 'naruto', 'onepiece'],
  },
  {
    id: 112,
    name: 'Sports',
    label: 'The thao',
    keywords: ['thethao', 'bongda', 'gym', 'fitness', 'workout', 'football', 'chaybo', 'bongban', 'caulong'],
  },
  {
    id: 115,
    name: 'Cars',
    label: 'Xe co',
    keywords: ['xe', 'oto', 'xemay', 'moto', 'car', 'supercar', 'racing', 'biker', 'xedo', 'xedien'],
  },
  {
    id: 118,
    name: 'Technology',
    label: 'Cong nghe',
    keywords: ['congnghe', 'dienthoai', 'iphone', 'laptop', 'ai', 'tech', 'pc', 'apple', 'android', 'laptrinh'],
  },
  {
    id: 105,
    name: 'Daily Life',
    label: 'Doi song',
    keywords: ['doisong', 'tamsu', 'cuocsong', 'vlog', 'lifestyle', 'chill', 'camxuc', 'giadinh'],
  },
  {
    id: 107,
    name: 'Relationship',
    label: 'Tinh cam',
    keywords: ['tinhyeu', 'nguoiyeu', 'tinhcam', 'crush', 'couple', 'henho', 'langman', 'tinhban'],
  },
  {
    id: 102,
    name: 'Beauty Care',
    label: 'Lam dep',
    keywords: ['lamdep', 'makeup', 'skincare', 'son', 'thoitrang', 'fashion', 'outfit', 'toc'],
  },
  {
    id: 120,
    name: 'Trending',
    label: 'Xu huong',
    keywords: ['xuhuong', 'trend', 'hot', 'viral', 'fyp', 'trending', 'all', 'phobien'],
  },
];

// Fallback emergency video URLs in case of total network timeout or expired cookies
const FALLBACK_VIDEOS = [
  {
    id: '7693873296588180756',
    desc: 'Hai huoc giai tri vui nhon',
    authorNickname: 'Han CM',
    authorUniqueId: 'hn.cm2',
    url: 'https://www.tiktok.com/@hn.cm2/video/7693873296588180756',
  },
  {
    id: '7697157842410769685',
    desc: 'Clip hai viral tiktok',
    authorNickname: 'Kykytv',
    authorUniqueId: 'kykytv',
    url: 'https://www.tiktok.com/@kykytv/video/7697157842410769685',
  },
  {
    id: '7693805023469243669',
    desc: 'Thu cung de thuong bat ngo',
    authorNickname: 'Ngan Ha',
    authorUniqueId: 'vnnha.203',
    url: 'https://www.tiktok.com/@vnnha.203/video/7693805023469243669',
  },
  {
    id: '7696152659891358982',
    desc: 'Game hay khoanh khac an tuong',
    authorNickname: 'No Pe',
    authorUniqueId: 'newpotential',
    url: 'https://www.tiktok.com/@newpotential/video/7696152659891358982',
  },
];

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Normalizes user input keyword by removing accents, spaces, and punctuation
 */
export function normalizeKeyword(kw) {
  if (!kw || typeof kw !== 'string') return '';
  return kw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Maps arbitrary search keyword to the most suitable TikTok Explore category ID
 */
export function findCategoryByKeyword(keyword) {
  const norm = normalizeKeyword(keyword);
  if (!norm) return 104; // Default to Comedy

  for (const cat of TIKTOK_EXPLORE_CATEGORIES) {
    for (const k of cat.keywords) {
      if (norm.includes(k) || k.includes(norm)) {
        return cat.id;
      }
    }
  }

  // If no specific match, default to Trending / All
  return 120;
}

/**
 * Queries TikTok Explore API with native X-Bogus signature
 */
export async function fetchExploreVideos(categoryType, count = 20, cookieStr = '') {
  const queryParams = new URLSearchParams({
    aid: '1988',
    app_language: 'vi-VN',
    app_name: 'tiktok_web',
    browser_language: 'vi-VN',
    browser_name: 'Mozilla',
    browser_online: 'true',
    browser_platform: 'Win32',
    browser_version: DEFAULT_USER_AGENT,
    categoryType: String(categoryType),
    channel: 'tiktok_web',
    cookie_enabled: 'true',
    count: String(count),
    device_platform: 'web_pc',
    focus_state: 'true',
    from_page: 'explore',
    history_len: '1',
    is_fullscreen: 'false',
    is_page_visible: 'true',
    os: 'windows',
    priority_region: 'VN',
    region: 'VN',
    screen_height: '1080',
    screen_width: '1920',
    tz_name: 'Asia/Saigon',
  });

  const rawUrl = `https://www.tiktok.com/api/explore/item_list/?${queryParams.toString()}`;
  const signedUrl = appendXBogusToUrl(rawUrl, DEFAULT_USER_AGENT);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(signedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Referer: 'https://www.tiktok.com/explore',
        Cookie: cookieStr || '',
        Accept: 'application/json, text/plain, */*',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP status ${res.status}`);
    }

    const data = await res.json();
    const items = data.itemList || [];

    return items
      .filter((item) => item && item.id && item.author?.uniqueId)
      .map((item) => ({
        id: String(item.id),
        desc: item.desc || '',
        authorNickname: item.author?.nickname || '',
        authorUniqueId: item.author?.uniqueId || '',
        url: `https://www.tiktok.com/@${item.author?.uniqueId}/video/${item.id}`,
        cover: item.video?.cover || item.video?.dynamicCover || '',
      }));
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[TiktokSearchService] fetchExploreVideos failed:', err.message);
    return [];
  }
}

/**
 * Loads list of previously sent video IDs for a conversation
 */
async function getSentVideoIds(conversationId) {
  if (!conversationId) return [];
  try {
    const key = `TIKTOK_SENT_VIDEOS_${conversationId}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Records a video ID as sent for a conversation with sliding window of 50
 */
async function recordSentVideoId(conversationId, videoId) {
  if (!conversationId || !videoId) return;
  try {
    const key = `TIKTOK_SENT_VIDEOS_${conversationId}`;
    const existing = await getSentVideoIds(conversationId);
    const updated = [String(videoId), ...existing.filter((id) => id !== String(videoId))].slice(0, 50);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
  } catch (_) {}
}

/**
 * Searches and randomly selects a fresh video matching keyword
 * Automatically avoids recently sent videos in the conversation
 */
export async function getRandomVideoByKeyword(keyword, cookieStr = '', conversationId = '') {
  const catId = findCategoryByKeyword(keyword);
  const previouslySent = conversationId ? await getSentVideoIds(conversationId) : [];
  const sentSet = new Set(previouslySent);

  let videoList = await fetchExploreVideos(catId, 25, cookieStr);

  // If primary category had zero items, fallback to Trending (120)
  if (videoList.length === 0 && catId !== 120) {
    videoList = await fetchExploreVideos(120, 25, cookieStr);
  }

  // If still zero items, use curated fallback list
  if (videoList.length === 0) {
    videoList = [...FALLBACK_VIDEOS];
  }

  // Filter out recently sent video IDs
  let available = videoList.filter((v) => !sentSet.has(v.id));
  if (available.length === 0) {
    // If all current videos were previously sent, recycle the pool
    available = videoList;
  }

  // Pick random video from candidate list
  const randomIndex = Math.floor(Math.random() * available.length);
  const selected = available[randomIndex];

  if (conversationId && selected && selected.id) {
    await recordSentVideoId(conversationId, selected.id);
  }

  return selected;
}

/**
 * Fast preview query for UI testing without recording to sent history
 */
export async function previewSearchVideo(keyword, cookieStr = '') {
  const catId = findCategoryByKeyword(keyword);
  let videoList = await fetchExploreVideos(catId, 15, cookieStr);

  if (videoList.length === 0 && catId !== 120) {
    videoList = await fetchExploreVideos(120, 15, cookieStr);
  }

  if (videoList.length === 0) {
    videoList = [...FALLBACK_VIDEOS];
  }

  const randomIndex = Math.floor(Math.random() * videoList.length);
  return videoList[randomIndex];
}
