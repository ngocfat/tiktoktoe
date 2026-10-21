/**
 * TikTok IMSDK and Web Social API communication service
 * Full reverse-engineered protocol ported from Python prototypes
 */
import { encodeObj, decodeProtobuf } from '../utils/protobuf.js';
import { appendXBogusToUrl, generateXBogus } from '../utils/signXbogus.js';
import { debugLogger } from './debugLoggerService.js';

export { generateXBogus, appendXBogusToUrl };

// Random UUID v4 generator
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Random 64-bit client ID generator
export function generateClientId() {
  const min = 7562600000000000000n;
  const max = 7562699999999999999n;
  const diff = max - min;
  const rand = BigInt(Math.floor(Math.random() * 100000000));
  return min + rand;
}

/**
 * 1. Fetches profile metadata (Avatar, Nickname, Handle) from Social Spotlight API
 */
export async function fetchUserProfiles(cookieStr) {
  const profileMap = {};
  let maxTime = 0;
  let hasMore = true;
  let page = 0;

  try {
    while (hasMore && page < 6) {
      page++;
      let url = 'https://www.tiktok.com/api/im/spotlight/relation/?aid=1988&count=100&with_fstatus=1';
      if (maxTime > 0) {
        url += `&max_time=${maxTime}`;
      }

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
          Referer: 'https://www.tiktok.com/',
          Cookie: cookieStr,
        },
      });

      if (!res.ok) break;

      const data = await res.json();
      const followings = data.followings || [];

      for (const u of followings) {
        const uid = String(u.uid || '');
        const avatarUrls = u.avatar_thumb?.url_list || [];
        const avatar = avatarUrls.length > 0 ? avatarUrls[0] : '';
        const followStatus = Number(u.follow_status ?? 1);
        profileMap[uid] = {
          nickname: u.nickname || `User ${uid}`,
          unique_id: u.unique_id || '',
          avatar: avatar,
          followStatus: followStatus,
          isFriend: followStatus >= 1,
        };
      }

      hasMore = data.has_more === 1 || data.has_more === true;
      maxTime = Number(data.min_time || 0);
      if (!maxTime || followings.length === 0) break;
    }
  } catch (err) {
    console.warn('Error fetching Spotlight profiles:', err);
  }

  return profileMap;
}

/**
 * 1.1 Fetches profile metadata for users (including unlinked/strangers)
 * via official TikTok IM Profile endpoint:
 * GET https://www.tiktok.com/tiktok/v1/im/user/profile/?aid=1988&user_ids=["uid1", "uid2"]
 */
export async function fetchMissingUserProfiles(cookieStr, uids) {
  if (!uids || uids.length === 0) return {};

  const profileMap = {};
  // Chunk into groups of at most 20 UIDs per request
  const chunkSize = 20;
  for (let i = 0; i < uids.length; i += chunkSize) {
    const chunk = uids.slice(i, i + chunkSize);
    try {
      const url = `https://www.tiktok.com/tiktok/v1/im/user/profile/?aid=1988&user_ids=${encodeURIComponent(
        JSON.stringify(chunk)
      )}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: '*/*',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
          Referer: 'https://www.tiktok.com/',
          Cookie: cookieStr,
        },
      });

      if (!res.ok) continue;

      const data = await res.json();
      const users = data.users || [];
      for (const u of users) {
        const prof = u.im_user_profile || {};
        const uid = String(prof.user_id_str || prof.user_id || prof.uid || '');
        if (!uid) continue;

        const av = prof.avatars || {};
        const avatarUrls =
          av.avatar_medium?.url_list ||
          av.avatar_small?.url_list ||
          av.avatar_choice?.url_list ||
          prof.avatar_thumb?.url_list ||
          prof.avatar_medium?.url_list ||
          [];
        const avatar = Array.isArray(avatarUrls) && avatarUrls.length > 0 ? avatarUrls[0] : '';

        const followStatus = Number(prof.follow_status ?? 0);
        profileMap[uid] = {
          nickname: prof.nick_name || prof.nickname || `User ${uid}`,
          unique_id: prof.unique_id || '',
          avatar: avatar,
          signature: prof.signature || '',
          followStatus: followStatus,
          isFriend: followStatus >= 1,
        };
      }
    } catch (err) {
      console.warn('Error fetching /tiktok/v1/im/user/profile/:', err);
    }
  }

  return profileMap;
}

/**
 * Extracts UID of currently authenticated account from Cookies
 */
export function getMyUidFromCookie(cookieStr) {
  if (!cookieStr) return '';
  const multiMatch = cookieStr.match(/multi_sids=([0-9]+)/);
  if (multiMatch) return multiMatch[1];
  const livingMatch = cookieStr.match(/living_user_id=([0-9]+)/);
  if (livingMatch) return livingMatch[1];
  const uidMatch = cookieStr.match(/(?:^|;\s*)(?:user_id|login_user_id)=([0-9]+)/);
  if (uidMatch) return uidMatch[1];
  return '';
}

/**
 * Fetches complete profile for currently authenticated account
 * Combines /passport/web/account/info/ and /tiktok/v1/im/user/profile/
 */
export async function fetchCurrentAccountProfile(cookieStr) {
  if (!cookieStr) return null;

  // 1. Attempt official TikTok Web Passport endpoint: /passport/web/account/info/
  try {
    const passportRes = await fetch('https://www.tiktok.com/passport/web/account/info/?aid=1988', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
        'Cookie': cookieStr,
      },
    });

    if (passportRes.ok) {
      const data = await passportRes.json();
      if (data && (data.message === 'success' || data.data?.user_id)) {
        const u = data.data || {};
        const uidStr = String(u.user_id_str || u.user_id || '');
        if (uidStr) {
          // Fetch canonical TikTok profile (nickname, handle, avatar)
          try {
            const imProfiles = await fetchMissingUserProfiles(cookieStr, [uidStr]);
            const imProf = imProfiles[uidStr];
            if (imProf && imProf.nickname) {
              return {
                uid: uidStr,
                nickname: imProf.nickname,
                unique_id: imProf.unique_id || u.username || '',
                avatar: imProf.avatar || u.avatar_url || '',
                signature: imProf.signature || '',
                isValidSession: true,
              };
            }
          } catch (imErr) {
            console.warn('Error fetching TikTok IM profile:', imErr);
          }

          // Fallback if IM profile fetch fails
          return {
            uid: uidStr,
            nickname: u.username ? `@${u.username}` : `User ${uidStr}`,
            unique_id: u.username || '',
            avatar: u.avatar_url || '',
            email: '',
            mobile: '',
            createTime: u.create_time || 0,
            isValidSession: true,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Error fetching /passport/web/account/info/:', err);
  }

  // 2. Fallback: extract UID from cookies and query /tiktok/v1/im/user/profile/
  try {
    const myUid = getMyUidFromCookie(cookieStr);
    if (myUid) {
      const profileMap = await fetchMissingUserProfiles(cookieStr, [myUid]);
      const prof = profileMap[myUid];
      if (prof) {
        return {
          uid: myUid,
          nickname: prof.nickname || `User ${myUid}`,
          unique_id: prof.unique_id || '',
          avatar: prof.avatar || '',
          signature: prof.signature || '',
          isValidSession: true,
        };
      }
      return {
        uid: myUid,
        nickname: `User ${myUid}`,
        unique_id: '',
        avatar: '',
        signature: '',
        isValidSession: true,
      };
    }
  } catch (err2) {
    console.warn('Fallback profile fetch error from UID:', err2);
  }

  return {
    uid: '',
    nickname: 'Unverified',
    unique_id: '',
    avatar: '',
    signature: '',
    isValidSession: false,
  };
}

/**
 * 2. Fetches complete conversation list from IMSDK (/v2/message/get_by_user_init)
 */
export async function fetchConversationList(cookieStr, deviceId = '7648200104730822164') {
  const url = 'https://im-api-sg.tiktok.com/v2/message/get_by_user_init';

  // Extract account UID from cookie if present
  let myUid = '';
  const match = cookieStr.match(/multi_sids=([0-9]+)/);
  if (match) {
    myUid = match[1];
  }

  // Step 1: Pre-fetch profiles from Spotlight
  const profileMap = await fetchUserProfiles(cookieStr);

  // Helper sending Protobuf CMD 203 request by category and pagination cursor
  const fetchByUserInitPage = async (category, cursor) => {
    const payloadDict = {
      '1': 203,
      '2': 10001 + category * 100 + cursor,
      '3': '1.8.2',
      '4': '',
      '5': 3,
      '6': category, // 0: Direct 1-to-1 inbox, 1: Group chats
      '7': '1132b10:master',
      '8': {
        '203': {
          '1': cursor,
        },
      },
      '9': String(deviceId),
      '11': 'web',
      '15': [
        { '1': 'aid', '2': '1988' },
        { '1': 'app_name', '2': 'tiktok_web' },
        { '1': 'channel', '2': 'web' },
        { '1': 'device_platform', '2': 'web_pc' },
        { '1': 'device_id', '2': String(deviceId) },
        { '1': 'region', '2': 'VN' },
        { '1': 'priority_region', '2': 'VN' },
        { '1': 'os', '2': 'windows' },
        { '1': 'referer', '2': 'https://www.tiktok.com/' },
        { '1': 'root_referer', '2': 'https://www.tiktok.com/' },
        { '1': 'cookie_enabled', '2': 'true' },
        { '1': 'screen_width', '2': '1920' },
        { '1': 'screen_height', '2': '1080' },
        { '1': 'browser_language', '2': 'vi-VN' },
        { '1': 'browser_platform', '2': 'Win32' },
        { '1': 'browser_name', '2': 'Mozilla' },
        {
          '1': 'browser_version',
          '2': '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
        },
        { '1': 'browser_online', '2': 'true' },
        { '1': 'verifyFp', '2': '' },
        { '1': 'app_language', '2': 'vi-VN' },
        { '1': 'webcast_language', '2': 'vi-VN' },
        { '1': 'tz_name', '2': 'Asia/Saigon' },
        { '1': 'is_page_visible', '2': 'true' },
        { '1': 'focus_state', '2': 'true' },
        { '1': 'is_fullscreen', '2': 'false' },
        { '1': 'history_len', '2': '3' },
        { '1': 'user_is_login', '2': 'true' },
        { '1': 'data_collection_enabled', '2': 'true' },
        { '1': 'from_appID', '2': '1988' },
        { '1': 'locale', '2': 'vi-VN' },
        {
          '1': 'user_agent',
          '2': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
        },
        {
          '1': 'Web-Sdk-Ms-Token',
          '2': 'mAcYkDC2M2CZjStJoOudO6wQkgDwfzggIvSWPVxljmgbwPUf-Qf6DEtdImO0djSfDgjHk8A5PC3y3YIzBSvp6eQEv27t9fJ8hZAyUP1JuYavQ4XhMbXtwmvp39sZEo1r5tVSFBQFvVtRYu-MYLuD5gdu1RLJJhL0lalOSw==',
        },
      ],
      '18': 1,
    };

    const bodyBytes = encodeObj(payloadDict);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/x-protobuf',
        'Content-Type': 'application/x-protobuf',
        Referer: 'https://www.tiktok.com/',
        Origin: 'https://www.tiktok.com',
        Cookie: cookieStr,
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36',
      },
      body: bodyBytes,
    });

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return decodeProtobuf(new Uint8Array(arrayBuffer));
  };

  const allMessages = [];
  const convMap = new Map();

  // Categories to query: 0 = 1-to-1 chats, 1 = Group chats
  const categoriesToFetch = [0, 1];

  for (const cat of categoriesToFetch) {
    let cursor = 0;
    const maxPages = cat === 0 ? 4 : 2;

    for (let page = 0; page < maxPages; page++) {
      try {
        const decoded = await fetchByUserInitPage(cat, cursor);
        if (!decoded) break;

        // Record myUid from Tag 15 if present
        if (!myUid && decoded?.['15']) {
          myUid = String(decoded['15']);
        }

        const body203 = decoded?.['6']?.['203'] || {};

        // Collect recent messages
        ['1', '1-1'].forEach((k) => {
          const item = body203[k];
          if (Array.isArray(item)) allMessages.push(...item);
          else if (item && typeof item === 'object') allMessages.push(item);
        });

        // Collect conversations
        let pageConvList = body203['2'] || [];
        if (!Array.isArray(pageConvList)) pageConvList = [pageConvList];

        for (const conv of pageConvList) {
          const rawCid = conv?.['1'];
          const cid = typeof rawCid === 'string' ? rawCid : (rawCid ? String(rawCid) : '');
          if (cid && !cid.startsWith('[object') && !convMap.has(cid)) {
            convMap.set(cid, conv);
          }
        }

        const hasMore = Number(body203?.['5'] || 0);
        if (hasMore !== 1 || pageConvList.length === 0) {
          break;
        }
        cursor += 10;
      } catch (e) {
        break;
      }
    }
  }

  const latestMsgByConv = {};
  for (const msg of allMessages) {
    const rawCid = msg?.['1'];
    const cid = typeof rawCid === 'string' ? rawCid : (rawCid ? String(rawCid) : '');
    if (!cid || cid.startsWith('[object')) continue;

    const timeVal = Number(msg?.['10'] || 0);
    if (!latestMsgByConv[cid] || timeVal > Number(latestMsgByConv[cid]?.['10'] || 0)) {
      latestMsgByConv[cid] = msg;
    }
  }

  const convList = Array.from(convMap.values());

  // Fallback: frequency analysis to deduce myUid if Tag 15 is omitted by server
  if (!myUid && convList.length > 0) {
    const uidFreq = {};
    for (const conv of convList) {
      const pList = conv?.['6']?.['1'] || [];
      const pArr = Array.isArray(pList) ? pList : [pList];
      for (const p of pArr) {
        const uid = p?.['1'] ? String(p['1']) : '';
        if (uid) uidFreq[uid] = (uidFreq[uid] || 0) + 1;
      }
    }
    let maxCount = 0;
    for (const [uid, count] of Object.entries(uidFreq)) {
      if (count > maxCount) {
        maxCount = count;
        myUid = uid;
      }
    }
  }

  // Collect unlinked user UIDs not in initial Spotlight profileMap
  const missingUids = new Set();
  for (const conv of convList) {
    const convType = Number(conv?.['3'] || 1);
    if (convType === 2) continue; // Skip groups

    const pList = conv?.['6']?.['1'] || [];
    const pArr = Array.isArray(pList) ? pList : [pList];
    const participants = [];
    for (const p of pArr) {
      if (p?.['1']) {
        const uid = String(p['1']);
        if (!participants.includes(uid)) participants.push(uid);
      }
    }

    const rawCid = conv?.['1'];
    const cid = typeof rawCid === 'string' ? rawCid : (rawCid ? String(rawCid) : '');
    if (cid.startsWith('0:1:')) {
      const parts = cid.split(':');
      if (parts.length >= 4) {
        if (!participants.includes(parts[2])) participants.push(parts[2]);
        if (!participants.includes(parts[3])) participants.push(parts[3]);
      }
    }

    const otherUid = (myUid ? participants.find((p) => p !== myUid) : '') || participants[0] || '';
    if (otherUid && otherUid !== myUid && !profileMap[otherUid]) {
      missingUids.add(otherUid);
    }
  }

  // Resolve missing profiles via /tiktok/v1/im/user/profile/
  if (missingUids.size > 0) {
    try {
      const strangerProfiles = await fetchMissingUserProfiles(cookieStr, Array.from(missingUids));
      Object.assign(profileMap, strangerProfiles);
    } catch (e) {
      console.warn('Error fetching missing user profiles:', e);
    }
  }

  const formattedConversations = [];
  const seenCids = new Set();

  for (const conv of convList) {
    const rawCid = conv?.['1'];
    const cid = typeof rawCid === 'string' ? rawCid : (rawCid ? String(rawCid) : '');
    if (!cid || cid.startsWith('[object') || seenCids.has(cid)) continue;
    seenCids.add(cid);

    const participants = [];
    const pList = conv?.['6']?.['1'] || [];
    const pArr = Array.isArray(pList) ? pList : [pList];
    for (const p of pArr) {
      if (p?.['1']) {
        const uid = String(p['1']);
        if (!participants.includes(uid)) participants.push(uid);
      }
    }

    if (cid.startsWith('0:1:')) {
      const parts = cid.split(':');
      if (parts.length >= 4) {
        if (!participants.includes(parts[2])) participants.push(parts[2]);
        if (!participants.includes(parts[3])) participants.push(parts[3]);
      }
    }

    const convType = Number(conv?.['3'] || 1);
    const isGroup = convType === 2;

    let targetUid = '';
    let nickname = '';
    let uniqueId = '';
    let avatar = '';
    let profile = {};

    if (isGroup) {
      const rawName5 = conv?.['50']?.['5'];
      const rawName6 = conv?.['50']?.['6'];
      const groupName =
        typeof rawName5 === 'string' && rawName5.trim()
          ? rawName5.trim()
          : typeof rawName6 === 'string' && rawName6.trim()
          ? rawName6.trim()
          : '';
      const groupIcon = typeof conv?.['50']?.['7'] === 'string' ? conv['50']['7'] : '';
      const memberCount = Number(conv?.['7'] || participants.length || 0);

      nickname = groupName || `Group Chat (${memberCount} members)`;
      avatar = groupIcon;
      uniqueId = `${memberCount} members`;
      targetUid = cid;
    } else {
      if (myUid) {
        targetUid = participants.find((p) => p !== myUid) || '';
      }
      if (!targetUid) {
        targetUid = participants.find((p) => p !== myUid) || participants[0] || '';
      }

      profile = profileMap[targetUid] || {};
      nickname = profile.nickname;
      if (!nickname) {
        if (targetUid === myUid && myUid) {
          nickname = 'Saved Messages';
        } else {
          nickname = `User ${targetUid}`;
        }
      }
      uniqueId = profile.unique_id || '';
      avatar = profile.avatar || '';
    }

    const lastMsg = latestMsgByConv[cid];
    let lastText = 'No messages yet';
    let lastSenderUid = '';
    let lastTime = 0;

    if (lastMsg) {
      lastSenderUid = String(lastMsg?.['7'] || '');
      lastTime = Number(lastMsg?.['10'] || 0);
      const rawContent = lastMsg?.['8'] || '';
      if (rawContent) {
        try {
          const jsonContent = JSON.parse(rawContent);
          if (jsonContent.text) lastText = jsonContent.text;
          else if (jsonContent.content_title) lastText = `[Video] ${jsonContent.content_title}`;
          else if (jsonContent.aweType) lastText = `[Type: ${jsonContent.aweType}]`;
        } catch (e) {
          lastText = String(rawContent);
        }
      }
    }

    const rawShortId = conv?.['2'] || conv?.['50']?.['2'] || '';
    const shortIdStr = typeof rawShortId === 'string' ? rawShortId : (rawShortId ? String(rawShortId) : '');
    const finalShortId = shortIdStr || (isGroup ? cid : '');

    const unreadCount = Number(conv?.['51']?.['17'] || 0);
    const updatedTs = Number(conv?.['13'] || 0);

    const isFriend = !isGroup && Boolean(profile?.isFriend || (profile?.followStatus && profile.followStatus >= 1));
    const isStranger = !isGroup && !isFriend;

    formattedConversations.push({
      conversationId: cid,
      conversationShortId: finalShortId,
      conversationType: convType,
      isGroup: isGroup,
      isFriend: isFriend,
      isStranger: isStranger,
      followStatus: profile?.followStatus || 0,
      targetUid: targetUid,
      myUid: myUid,
      nickname: nickname,
      uniqueId: uniqueId,
      avatar: avatar,
      lastMessageText: lastText,
      lastSenderUid: lastSenderUid,
      lastMessageTime: lastTime,
      unreadCount: unreadCount,
      updatedTime: updatedTs,
    });
  }

  // Sort by latest message timestamp descending
  formattedConversations.sort((a, b) => {
    const timeA = a.lastMessageTime || a.updatedTime || 0;
    const timeB = b.lastMessageTime || b.updatedTime || 0;
    return timeB - timeA;
  });

  return formattedConversations;
}

/**
 * 3. Sends message via Web IMSDK (/v1/message/send)
 */
export async function sendTiktokMessage(
  cookieStr,
  conversationId,
  text,
  conversationType = 1,
  conversationShortId = '',
  deviceId = '7648200104730822164'
) {
  const userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  // Extract tt_csrf_token from cookie string
  const csrfMatch = cookieStr.match(/tt_csrf_token=([^; ]+)/);
  const csrfToken = csrfMatch ? csrfMatch[1] : '';

  // Sign dynamic X-Bogus signature
  const baseQueryUrl = 'https://im-api-sg.tiktok.com/v1/message/send?aid=1988&device_platform=web_pc';
  const signedUrl = appendXBogusToUrl(baseQueryUrl, userAgent);

  const newUuid = generateUUID();
  debugLogger.addLog('TIKTOK_API', 'info', `Preparing message: "${text.slice(0, 30)}..." to CID: ${conversationId}`);

  // Resolve conversation_short_id (Tag 3 in block 100)
  // For group chats (convType = 2), conversation_short_id must be 64-bit BigInt of group ID
  let shortIdNum;
  if (conversationShortId && /^\d+$/.test(String(conversationShortId))) {
    shortIdNum = BigInt(String(conversationShortId));
  } else if (Number(conversationType) === 2 || !conversationId.startsWith('0:1:')) {
    try {
      shortIdNum = BigInt(conversationId);
    } catch (e) {
      shortIdNum = generateClientId();
    }
  } else {
    shortIdNum = generateClientId();
  }

  const payloadDict = {
    '1': 100, // CMD 100: SendMessage
    '2': 10005,
    '3': '1.8.2',
    '4': '',
    '5': 3,
    '6': 0,
    '7': '1132b10:master',
    '8': {
      '100': {
        '1': conversationId,
        '2': Number(conversationType || 1),
        '3': shortIdNum,
        '4': JSON.stringify({
          text: text,
          aweType: 0,
        }),
        '5': [
          { '1': 'a:msg_req_type', '2': '1' },
          { '1': 'a:process_id', '2': generateUUID() },
        ],
        '6': 7,
        '8': newUuid,
      },
    },
    '9': String(deviceId),
    '11': 'web',
    '15': [
      { '1': 'aid', '2': '1988' },
      { '1': 'app_name', '2': 'tiktok_web' },
      { '1': 'channel', '2': 'web' },
      { '1': 'device_platform', '2': 'web_pc' },
      { '1': 'device_id', '2': String(deviceId) },
      { '1': 'region', '2': 'VN' },
      { '1': 'priority_region', '2': 'VN' },
      { '1': 'os', '2': 'windows' },
      { '1': 'referer', '2': 'https://www.tiktok.com/' },
      { '1': 'root_referer', '2': 'https://www.tiktok.com/' },
      { '1': 'cookie_enabled', '2': 'true' },
      { '1': 'screen_width', '2': '1920' },
      { '1': 'screen_height', '2': '1080' },
      { '1': 'browser_language', '2': 'vi-VN' },
      { '1': 'browser_platform', '2': 'Win32' },
      { '1': 'browser_name', '2': 'Mozilla' },
      {
        '1': 'browser_version',
        '2': userAgent,
      },
      { '1': 'browser_online', '2': 'true' },
      { '1': 'verifyFp', '2': '' },
      { '1': 'app_language', '2': 'vi-VN' },
      { '1': 'webcast_language', '2': 'vi-VN' },
      { '1': 'tz_name', '2': 'Asia/Saigon' },
      { '1': 'is_page_visible', '2': 'true' },
      { '1': 'focus_state', '2': 'true' },
      { '1': 'is_fullscreen', '2': 'false' },
      { '1': 'history_len', '2': '3' },
      { '1': 'user_is_login', '2': 'true' },
      { '1': 'data_collection_enabled', '2': 'true' },
      { '1': 'from_appID', '2': '1988' },
      { '1': 'locale', '2': 'vi-VN' },
      {
        '1': 'user_agent',
        '2': userAgent,
      },
    ],
    '18': 1,
  };

  const bodyBytes = encodeObj(payloadDict);

  const headers = {
    Accept: 'application/x-protobuf',
    'Content-Type': 'application/x-protobuf',
    Referer: 'https://www.tiktok.com/messages',
    Origin: 'https://www.tiktok.com',
    Cookie: cookieStr,
    'User-Agent': userAgent,
  };

  if (csrfToken) {
    headers['x-secsdk-csrf-token'] = csrfToken;
  }

  const res = await fetch(signedUrl, {
    method: 'POST',
    headers: headers,
    body: bodyBytes,
  });

  if (!res.ok) {
    debugLogger.addLog('TIKTOK_API', 'error', `Message send failed: HTTP Error ${res.status}`);
    throw new Error(`HTTP Error: ${res.status}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const decoded = decodeProtobuf(new Uint8Array(arrayBuffer));
  const statusCode = decoded?.['3'];
  const statusMsg = decoded?.['4'];
  const serverMsgId = decoded?.['6']?.['100']?.['1'];
  const msgStatus = Number(decoded?.['6']?.['100']?.['5'] ?? -1); // Tag 5: 0 = Success, 2 = Filtered/Blocked
  const checkTips = decoded?.['6']?.['100']?.['6'];

  debugLogger.addLog(
    'TIKTOK_API',
    statusCode === 0 && msgStatus === 0 ? 'success' : 'warn',
    `IMSDK response: Code=${statusCode}, MsgStatus=${msgStatus}, ServerMsgId=${serverMsgId || 'None'}`
  );

  let tipMsg = '';
  if (checkTips) {
    try {
      const tipJson = typeof checkTips === 'string' ? JSON.parse(checkTips) : checkTips;
      if (tipJson.tips) {
        tipMsg = tipJson.tips;
      } else if (tipJson.status_msg?.msg_content?.tips) {
        tipMsg = tipJson.status_msg.msg_content.tips;
      } else if (tipJson.decision_detail === 'ban') {
        tipMsg = 'Account sending ban imposed by TikTok (sending_ban)';
      }
    } catch (e) {
      if (String(checkTips).includes('sending_ban') || String(checkTips).includes('ban')) {
        tipMsg = 'Message blocked by TikTok (sending_ban / community guidelines)';
      }
    }
  }

  // A message is successful only when:
  // 1. High level status code is 0
  // 2. Server Message ID is allocated
  // 3. msgStatus (Tag 5 in block 100) equals 0 (2 indicates blocked by Safety Filter)
  const isSuccess = (statusCode === 0 || statusCode === 0n || statusCode === '0') && !!serverMsgId && msgStatus === 0;

  let finalStatusText = 'OK';
  if (!isSuccess) {
    if (tipMsg) {
      finalStatusText = tipMsg;
    } else if (msgStatus === 2) {
      finalStatusText = 'Blocked by TikTok (sending_ban / filter)';
    } else if (statusMsg) {
      finalStatusText = String(statusMsg);
    } else {
      finalStatusText = `Error code: ${statusCode}`;
    }
  }

  return {
    success: isSuccess,
    statusText: finalStatusText,
    serverMsgId: serverMsgId ? String(serverMsgId) : null,
    msgStatus: msgStatus,
    xBogus: signedUrl.includes('X-Bogus=') ? signedUrl.split('X-Bogus=')[1] : '',
    rawResponse: decoded,
  };
}
