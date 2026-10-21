import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  API_KEY: 'GEMINI_API_KEY',
  STYLE: 'GEMINI_STREAK_STYLE',
  ACTIVE_MODEL: 'GEMINI_ACTIVE_MODEL',
};

// Exclusion keywords: Specialized non-text models (TTS, embedding, audio, vision)
const EXCLUDED_KEYWORDS = [
  'tts',
  'embedding',
  'audio',
  'image',
  'imagen',
  'learnlm',
  'robotics',
  'vision',
  'gemini-2.5-pro', // Deprecated by Google for new users
];

// Recommended text generation models in preferential order
const PREFERRED_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-pro-preview',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-pro',
];

// Fallback curated streak quotes
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
 * Retrieves persisted Gemini API Key
 */
export async function getGeminiApiKey() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.API_KEY)) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Persists Gemini API Key
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
 * Retrieves currently active Gemini model
 */
export async function getActiveGeminiModel() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.ACTIVE_MODEL)) || '';
  } catch (e) {
    return '';
  }
}

/**
 * Persists currently active Gemini model
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
 * Retrieves configured streak message tone/style
 */
export async function getGeminiStreakStyle() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.STYLE)) || 'FUNNY';
  } catch (e) {
    return 'FUNNY';
  }
}

/**
 * Persists configured streak message tone/style
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
 * Queries Google Generative Language API for models accessible with provided API Key.
 * Filters for text generation models, excluding audio, embedding, and TTS.
 */
export async function getAvailableGeminiModels(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { success: false, error: 'API Key not provided', models: [] };
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
      const errMsg = errJson?.error?.message || `Google API error (HTTP ${res.status})`;
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
          // Exclude TTS, Audio, Embedding, Vision-only models
          return !EXCLUDED_KEYWORDS.some((kw) => lowerName.includes(kw));
        })
        .map((m) => m.name.replace(/^models\//, ''));

      return { success: true, models: supported };
    }

    return { success: false, error: 'No models found from Google API response', models: [] };
  } catch (err) {
    return { success: false, error: err.message || 'Network error connecting to Google API', models: [] };
  }
}

/**
 * Picks fastest and most optimal model from available list
 */
export function pickBestModel(availableModels) {
  if (!availableModels || availableModels.length === 0) {
    return 'gemini-1.5-flash';
  }

  // 1. Check preferred high-speed Flash models
  for (const pref of PREFERRED_MODELS) {
    if (availableModels.includes(pref)) {
      return pref;
    }
  }

  // 2. Prioritize model containing 'flash'
  const flash = availableModels.find(
    (m) =>
      m.toLowerCase().includes('flash') &&
      !EXCLUDED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw))
  );
  if (flash) return flash;

  // 3. Prioritize standard Gemini text models
  const gemini = availableModels.find(
    (m) =>
      m.toLowerCase().includes('gemini') &&
      !EXCLUDED_KEYWORDS.some((kw) => m.toLowerCase().includes(kw))
  );
  if (gemini) return gemini;

  return availableModels[0];
}

/**
 * Checks if error message indicates quota exhaustion
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
 * Tests Google Gemini API Key connectivity and discovers optimal text model
 */
export async function testGeminiApiKey(apiKey) {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { success: false, error: 'Please enter a Gemini API Key.' };
  }

  // Step 1: Call ListModels to verify key validity
  const modelsRes = await getAvailableGeminiModels(cleanKey);
  if (!modelsRes.success) {
    return { success: false, error: modelsRes.error };
  }

  let availableModels = modelsRes.models;
  if (!availableModels || availableModels.length === 0) {
    availableModels = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash-8b'];
  }

  // Sort candidate models with preferred Flash models first
  const primaryModel = pickBestModel(availableModels);
  const remaining = availableModels.filter((m) => m !== primaryModel);
  const modelsToTry = [primaryModel, ...remaining];

  let lastError = '';
  let hadQuotaError = false;

  // Attempt up to 8 candidate models
  for (const model of modelsToTry.slice(0, 8)) {
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
              parts: [{ text: 'Respond with exactly one word: OK' }],
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
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        await saveActiveGeminiModel(model);
        return {
          success: true,
          model: model,
          reply: text.trim(),
          availableModels: availableModels,
        };
      }
    } catch (err) {
      lastError = err.message || 'Network error testing model';
    }
  }

  if (hadQuotaError) {
    return {
      success: false,
      error:
        'Your Google account has reached its daily free quota on Gemini models. You can create a new API Key from another Google account at aistudio.google.com.',
    };
  }

  return {
    success: false,
    error: lastError || 'Unable to receive response from available Gemini models.',
  };
}

/**
 * Cleans and validates raw text output returned from AI
 */
function cleanStreakOutput(rawText) {
  if (!rawText) return null;

  // Filter out thinking tokens, metadata prefixes, and boilerplate greetings
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

  let text = cleanLines.join(' ');

  // Strip markdown formatting
  text = text.replace(/\*\*/g, '').replace(/\*/g, '');

  // Strip leading and trailing quotation marks and labels
  text = text
    .replace(/^["'«“\s]+/, '')
    .replace(/["'»”\s]+$/, '')
    .replace(/^(câu quote|câu nói|quote|status|tin nhắn mới|câu mới|tin nhắn|gợi ý|câu giữ chuỗi|model|bot|ai):\s*/i, '')
    .replace(/^["'«“\s]+/, '')
    .replace(/["'»”\s]+$/, '')
    .trim();

  // Strip dangling punctuation
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

  // Discard response if AI regurgitated English prompt instructions
  if (badSignatures.some((sig) => lower.includes(sig))) {
    return null;
  }

  if (text.length < 3) return null;

  return text;
}

/**
 * Generates dynamic streak quote using Google Gemini API
 */
export async function generateStreakMessageWithGemini(apiKey = '', style = null, targetName = '') {
  let key = (apiKey || '').trim();
  if (!key) {
    key = await getGeminiApiKey();
  }

  // Return random fallback quote if no API key is configured
  if (!key) {
    const randomIndex = Math.floor(Math.random() * FALLBACK_STREAK_MESSAGES.length);
    return {
      text: FALLBACK_STREAK_MESSAGES[randomIndex],
      source: 'FALLBACK',
    };
  }

  // Load configured persona style
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

  const promptText = `Hãy viết 1 câu quote hoặc status ngắn ${styleDesc} bằng tiếng Việt. Câu phải có ý nghĩa trọn vẹn, không viết dở dang, không kết thúc bằng dấu phẩy. Chỉ trả về đúng 1 câu nói đó.`;

  let modelsToTry = [];

  // Query accessible models for current key
  const modelsRes = await getAvailableGeminiModels(key);
  if (modelsRes.success && modelsRes.models.length > 0) {
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

    // Gemma fallback candidates
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
        console.warn(`Model ${model} request error HTTP ${res.status}:`, errJson?.error?.message || errJson);
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
      console.warn(`Gemini model ${model} invocation error:`, e);
    }
  }

  // Fallback quote if API call fails or quota runs out
  const randomIndex = Math.floor(Math.random() * FALLBACK_STREAK_MESSAGES.length);
  return {
    text: FALLBACK_STREAK_MESSAGES[randomIndex],
    source: 'FALLBACK',
  };
}
