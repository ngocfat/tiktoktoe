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
 * Strips Vietnamese accents and normalizes search strings to lowercase
 */
export function stripAccents(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Filters a pool of videos based on arbitrary user-provided search keywords
 * Performs 3-tier relevance matching: exact phrase, multi-token, and any token
 */
export function filterVideosByKeyword(videoList, rawKeyword) {
  if (!rawKeyword || typeof rawKeyword !== 'string' || !Array.isArray(videoList)) {
    return videoList || [];
  }
  const cleanKeyword = stripAccents(rawKeyword).trim();
  if (!cleanKeyword) return videoList;

  const tokens = cleanKeyword.split(/\s+/).filter((t) => t.length >= 2);

  // 1. Exact phrase match in description or author info
  const exactPhrase = videoList.filter((v) => {
    const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
    return text.includes(cleanKeyword);
  });
  if (exactPhrase.length > 0) return exactPhrase;

  // 2. All tokens present in caption or author info
  if (tokens.length > 1) {
    const allTokens = videoList.filter((v) => {
      const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
      return tokens.every((t) => text.includes(t));
    });
    if (allTokens.length > 0) return allTokens;
  }

  // 3. Any token present in caption or author info
  if (tokens.length > 0) {
    const anyToken = videoList.filter((v) => {
      const text = stripAccents(`${v.desc} ${v.authorNickname} ${v.authorUniqueId}`);
      return tokens.some((t) => text.includes(t));
    });
    if (anyToken.length > 0) return anyToken;
  }

  // Fallback to original candidate pool if no text tokens matched
  return videoList;
}

/**
 * Searches and randomly selects a fresh video matching user-entered keyword
 * Automatically avoids recently sent videos in the conversation
 */
export async function getRandomVideoByKeyword(userKeyword, cookieStr = '', conversationId = '') {
  const catId = findCategoryByKeyword(userKeyword);
  const previouslySent = conversationId ? await getSentVideoIds(conversationId) : [];
  const sentSet = new Set(previouslySent);

  // Fetch from the mapped category stream
  let videoList = await fetchExploreVideos(catId, 25, cookieStr);

  // If not already in Trending, merge items from Trending to broaden custom keyword search coverage
  if (catId !== 120) {
    const trendingList = await fetchExploreVideos(120, 20, cookieStr);
    if (trendingList.length > 0) {
      const existingIds = new Set(videoList.map((v) => v.id));
      for (const t of trendingList) {
        if (!existingIds.has(t.id)) {
          videoList.push(t);
        }
      }
    }
  }

  // If still zero items, use curated fallback list
  if (videoList.length === 0) {
    videoList = [...FALLBACK_VIDEOS];
  }

  // Filter candidates matching user's specific typed keyword in title / caption / hashtags
  const matchedList = filterVideosByKeyword(videoList, userKeyword);

  // Filter out recently sent video IDs in this conversation
  let available = matchedList.filter((v) => !sentSet.has(v.id));
  if (available.length === 0) {
    available = videoList.filter((v) => !sentSet.has(v.id));
  }
  if (available.length === 0) {
    available = matchedList.length > 0 ? matchedList : videoList;
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
 * Matches user's custom typed keyword in real time
 */
export async function previewSearchVideo(userKeyword, cookieStr = '') {
  const catId = findCategoryByKeyword(userKeyword);
  let videoList = await fetchExploreVideos(catId, 20, cookieStr);

  if (catId !== 120) {
    const trendingList = await fetchExploreVideos(120, 15, cookieStr);
    if (trendingList.length > 0) {
      const existingIds = new Set(videoList.map((v) => v.id));
      for (const t of trendingList) {
        if (!existingIds.has(t.id)) {
          videoList.push(t);
        }
      }
    }
  }

  if (videoList.length === 0) {
    videoList = [...FALLBACK_VIDEOS];
  }

  // Filter by user's typed keyword
  const matchedList = filterVideosByKeyword(videoList, userKeyword);
  const candidatePool = matchedList.length > 0 ? matchedList : videoList;

  const randomIndex = Math.floor(Math.random() * candidatePool.length);
  return candidatePool[randomIndex];
}
