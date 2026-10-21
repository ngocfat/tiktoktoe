import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  API_KEY: 'GEMINI_API_KEY',
  STYLE: 'GEMINI_STREAK_STYLE',
  ACTIVE_MODEL: 'GEMINI_ACTIVE_MODEL',
};

// Từ khóa loại trừ: Các model chuyên dụng âm thanh (TTS), embedding, hình ảnh không dùng cho sinh văn bản
const EXCLUDED_KEYWORDS = [
  'tts',
  'embedding',
  'audio',
  'image',
  'imagen',
  'learnlm',
  'robotics',
  'vision',
  'gemini-2.5-pro', // Google thông báo đã ngừng cung cấp cho user mới
];

// Danh sách các model văn bản chuẩn thế hệ mới của Google
const PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro',
];

// Danh sách câu quote vu vơ hài hước dự phòng
export const FALLBACK_STREAK_MESSAGES = [
  'Đang bận thở, lát rep sau nha!',
  'Hôm nay trời đẹp, tự nhiên nhớ bạn ghê.',
  'Alo bạn hiền, cuộc sống dạo này ổn áp không?',
  'Ngày mới vui vẻ, không quạu không sầu nha!',
  'Tin nhắn này không có gì ngoài sự đẹp trai/xinh gái.',
  'Uống miếng nước cho đỡ khát nè bạn ơi!',
  'Một ngày bình thường của một con người phi thường.',
  'Nhắn một câu vu vơ cho đời thêm rực rỡ.',
  'Trăm năm Kiều vẫn là Kiều, bạn thân rep chậm là điều hiển nhiên.',
  'Tình bạn diệu kỳ, thấy tin nhắn nhớ thả tim nha!',
];

/**
 * Lấy Gemini API Key đã lưu
 */
export async function getGeminiApiKey() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.API_KEY)) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Lưu Gemini API Key
 */
export async function saveGeminiApiKey(key) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.API_KEY, (key || '').trim());
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Lấy model Gemini đang hoạt động
 */
export async function getActiveGeminiModel() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_MODEL)) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Lưu model Gemini đang hoạt động
 */
export async function saveActiveGeminiModel(model) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.ACTIVE_MODEL, (model || '').trim());
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Lấy phong cách câu thoại AI được cấu hình
 */
export async function getGeminiStreakStyle() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.STYLE)) || 'FUNNY';
  } catch (e) {
    return 'FUNNY';
  }
}

/**
 * Lưu phong cách câu thoại
 */
export async function saveGeminiStreakStyle(style) {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.STYLE, style);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Tự động truy vấn danh sách model được Google hỗ trợ cho API Key này,
 * chỉ lấy các model văn bản chuẩn (loại trừ TTS, Audio, Embedding)
 */
export async function getAvailableGeminiModels(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { success: false, error: 'Chưa nhập API Key', models: [] };
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-goog-api-key': cleanKey,
      },
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const errMsg = errJson?.error?.message || `Lỗi Google API (HTTP ${res.status})`;
      return { success: false, error: errMsg, models: [] };
    }

    const data = await res.json();
    if (Array.isArray(data.models)) {
      const supported = data.models
        .filter((m) => {
          if (
            !Array.isArray(m.supportedGenerationMethods) ||
            !m.supportedGenerationMethods.includes('generateContent')
          ) {
            return false;
          }
          const lowerName = (m.name || '').toLowerCase();
          // Loại trừ triệt để TTS, Audio, Embedding, Vision-only
          return !EXCLUDED_KEYWORDS.some((kw) => lowerName.includes(kw));
        })
        .map((m) => m.name.replace(/^models\//, ''));

      return { success: true, models: supported };
    }

    return { success: false, error: 'Không tìm thấy danh sách model từ Google', models: [] };
  } catch (err) {
    return { success: false, error: err.message || 'Lỗi kết nối mạng đến Google', models: [] };
  }
}

/**
 * Chọn model tốt nhất, nhanh và tối ưu nhất từ danh sách khả dụng
 */
export function pickBestModel(availableModels) {
  if (!availableModels || availableModels.length === 0) {
    return 'gemini-1.5-flash';
  }

  // 1. Tìm theo danh sách ưu tiên hàng đầu (Flash models)
  for (const pref of PREFERRED_MODELS) {
    if (availableModels.includes(pref)) {
      return pref;
    }
  }

  // 2. Ưu tiên model nào có chữ "flash" mà không dính từ khóa cấm
  const flash = availableModels.find(
    (m) =>
      m.toLowerCase().includes('flash') &&
      !EXCLUDED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw))
  );
  if (flash) return flash;

  // 3. Ưu tiên model nào có chữ "gemini" thuần văn bản
  const gemini = availableModels.find(
    (m) =>
      m.toLowerCase().includes('gemini') &&
      !EXCLUDED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw))
  );
  if (gemini) return gemini;

  return availableModels[0];
}

/**
 * Kiểm tra xem chuỗi lỗi có phải là do hết hạn mức quota hay không
 */
function isQuotaExceededError(errMsg) {
  if (!errMsg) return false;
  const lower = errMsg.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('limit: 0') ||
    lower.includes('exceeded') ||
    lower.includes('429')
  );
}

/**
 * Kiểm tra kết nối API Key với Google Gemini
 * Tự động lọc sạch model TTS và tìm model văn bản khả dụng có Free Quota
 */
export async function testGeminiApiKey(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { success: false, error: 'Vui lòng nhập API Key của Gemini!' };
  }

  // Bước 1: Gọi ModelService.ListModels để kiểm tra tính hợp lệ của Key
  const modelsRes = await getAvailableGeminiModels(cleanKey);
  if (!modelsRes.success) {
    return { success: false, error: modelsRes.error };
  }

  let availableModels = modelsRes.models;
  // Nếu list models bị rỗng do lọc quá chặt, dùng danh sách fallback Flash tiêu chuẩn
  if (!availableModels || availableModels.length === 0) {
    availableModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
  }

  // Sắp xếp các model: đưa các model ưu tiên (Flash) lên đầu
  const primaryModel = pickBestModel(availableModels);
  const remaining = availableModels.filter((m) => m !== primaryModel);
  const modelsToTry = [primaryModel, ...remaining];

  let lastError = '';
  let hadQuotaError = false;

  // Thử lần lượt tối đa 8 model văn bản hợp lệ
  for (const model of modelsToTry.slice(0, 8)) {
    // Bỏ qua nếu tên model chứa tts hoặc bị loại trừ
    if (EXCLUDED_KEYWORDS.some((kw) => model.toLowerCase().includes(kw))) {
      continue;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'Trả lời đúng 1 chữ: OK' }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 10,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson?.error?.message || `HTTP ${res.status}`;
        lastError = msg;
        if (isQuotaExceededError(msg)) {
          hadQuotaError = true;
        }
        // Thử model tiếp theo
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        // Lưu lại model hoạt động tốt này
        await saveActiveGeminiModel(model);
        return {
          success: true,
          model: model,
          reply: text.trim(),
          availableModels: availableModels,
        };
      }
    } catch (err) {
      lastError = err.message || 'Lỗi mạng khi thử gọi model';
    }
  }

  if (hadQuotaError) {
    return {
      success: false,
      error:
        'Tài khoản Google của bạn đã dùng hết hạn mức (Quota) miễn phí hôm nay trên các model Gemini. Bạn có thể tạo 1 API Key mới từ tài khoản Google khác tại aistudio.google.com để dùng ngay.',
    };
  }

  return {
    success: false,
    error: lastError || 'Không thể nhận phản hồi từ các model Gemini khả dụng.',
  };
}

/**
 * Gọi Gemini để sinh ngẫu nhiên 1 câu giữ chuỗi ngắn gọn, hài hước
 */
/**
 * Làm sạch và kiểm tra chất lượng câu quote trả về từ AI
 */
function cleanStreakOutput(rawText) {
  if (!rawText) return null;

  // 1. Tách các dòng và lọc bỏ các dòng suy nghĩ dạng '* Goal:', '* Purpose:', lời mở đầu của AI
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const cleanLines = lines.filter((line) => {
    const lower = line.toLowerCase();
    return (
      !lower.startsWith('* goal') &&
      !lower.startsWith('* purpose') &&
      !lower.startsWith('goal:') &&
      !lower.startsWith('purpose:') &&
      !lower.startsWith('* target') &&
      !lower.startsWith('* format') &&
      !lower.startsWith('* note') &&
      !lower.startsWith('* output') &&
      !lower.startsWith('* draft') &&
      !lower.startsWith('dưới đây là') &&
      !lower.startsWith('đây là') &&
      !lower.startsWith('gợi ý cho bạn') &&
      !lower.startsWith('here is') &&
      !lower.startsWith('sure,')
    );
  });

  if (cleanLines.length === 0) return null;

  // Ghép toàn bộ nội dung của AI lại, tuyệt đối không tự ý cắt bỏ các dòng tiếp theo
  let text = cleanLines.join(' ');

  // Xóa định dạng markdown nếu có
  text = text.replace(/\*\*/g, '').replace(/\*/g, '');

  // Bỏ dấu nháy kép, nháy đơn, tiền tố rườm rà ở 2 đầu
  text = text
    .replace(/^["'«“\s]+/, '')
    .replace(/["'»”\s]+$/, '')
    .replace(/^(câu quote|câu nói|quote|status|tin nhắn mới|câu mới|tin nhắn|gợi ý|câu giữ chuỗi|model|bot|ai):\s*/i, '')
    .replace(/^["'«“\s]+/, '')
    .replace(/["'»”\s]+$/, '')
    .trim();

  // Bỏ dấu phẩy hoặc gạch ngang lơ lửng ở cuối nếu AI vô tình để dở dang
  text = text.replace(/[,;\-\s]+$/, '').trim();

  const lower = text.toLowerCase();
  const badSignatures = [
    'close friend',
    'create exactly',
    'vietnamese-style',
    'maintain a daily',
    'tiktok streak',
    'length: extremely short',
    '* length:',
    '* format',
    'here is a',
    'sure, here',
    'goal:',
    'purpose:',
  ];

  // Nếu câu trả về bị dịch sang tiếng Anh hoặc nhại lại prompt
  if (badSignatures.some((sig) => lower.includes(sig))) {
    return null;
  }

  if (text.length < 3) return null;

  return text;
}

/**
 * Gọi Gemini / Gemma để sinh ngẫu nhiên 1 câu quote vu vơ ngắn gọn
 */
export async function generateStreakMessageWithGemini(apiKey = '', style = null, targetName = '') {
  let key = (apiKey || '').trim();
  if (!key) {
    key = await getGeminiApiKey();
  }

  // Nếu không có API Key, lấy ngẫu nhiên câu dự phòng
  if (!key) {
    const randomIndex = Math.floor(Math.random() * FALLBACK_STREAK_MESSAGES.length);
    return {
      text: FALLBACK_STREAK_MESSAGES[randomIndex],
      source: 'FALLBACK',
    };
  }

  // Lấy phong cách đã cấu hình
  let activeStyle = style;
  if (!activeStyle) {
    activeStyle = await getGeminiStreakStyle();
  }

  let styleDesc = 'hài hước';
  if (activeStyle === 'TRENDING') {
    styleDesc = 'bắt trend TikTok';
  } else if (activeStyle === 'CUTE') {
    styleDesc = 'dễ thương';
  } else if (activeStyle === 'COOL') {
    styleDesc = 'cực ngầu';
  }

  // Prompt tự nhiên, yêu cầu rõ ràng câu phải hoàn chỉnh, có vế đầy đủ
  const promptText = `Hãy viết 1 câu quote hoặc status ngắn ${styleDesc} bằng tiếng Việt. Câu phải có ý nghĩa trọn vẹn, không viết dở dang, không kết thúc bằng dấu phẩy. Chỉ trả về đúng 1 câu nói đó.`;

  let modelsToTry = [];

  // Lấy danh sách model THỰC TẾ mà tài khoản Google cấp quyền
  const modelsRes = await getAvailableGeminiModels(key);
  if (modelsRes.success && modelsRes.models.length > 0) {
    // 1. Luôn ưu tiên các model Gemini trước (gemini-2.5-flash, gemini-3.1-pro-preview, gemini-2.0-flash)
    const geminiModels = modelsRes.models.filter(
      (m) =>
        m.toLowerCase().includes('gemini') &&
        !EXCLUDED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw))
    );
    for (const pref of PREFERRED_MODELS) {
      if (geminiModels.includes(pref) && !modelsToTry.includes(pref)) {
        modelsToTry.push(pref);
      }
    }
    for (const gm of geminiModels) {
      if (!modelsToTry.includes(gm)) {
        modelsToTry.push(gm);
      }
    }

    // 2. Các model Gemma dự phòng sau cùng
    const gemmaModels = modelsRes.models.filter(
      (m) =>
        m.toLowerCase().includes('gemma') &&
        !EXCLUDED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw))
    );
    for (const gm of gemmaModels) {
      if (!modelsToTry.includes(gm)) {
        modelsToTry.push(gm);
      }
    }
  } else {
    for (const m of PREFERRED_MODELS) {
      if (!modelsToTry.includes(m)) {
        modelsToTry.push(m);
      }
    }
  }

  for (const model of modelsToTry.slice(0, 8)) {
    if (EXCLUDED_KEYWORDS.some((kw) => model.toLowerCase().includes(kw))) {
      continue;
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: promptText }],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 300,
          },
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`Lỗi gọi model ${model} HTTP ${res.status}:`, errJson?.error?.message || errJson);
        continue;
      }

      const data = await res.json();
      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      console.log(`[Gemini ${model} RAW]:`, rawText);
      const cleaned = cleanStreakOutput(rawText);
      console.log('[Gemini Cleaned]:', cleaned);

      if (cleaned) {
        await saveActiveGeminiModel(model);
        return {
          text: cleaned,
          source: 'GEMINI',
          model: model,
        };
      }
    } catch (e) {
      console.warn(`Lỗi gọi Gemini model ${model}:`, e);
    }
  }

  // Fallback nếu Gemini API lỗi mạng hoặc hết hạn mức Quota
  const randomIndex = Math.floor(Math.random() * FALLBACK_STREAK_MESSAGES.length);
  return {
    text: FALLBACK_STREAK_MESSAGES[randomIndex],
    source: 'FALLBACK',
  };
}
