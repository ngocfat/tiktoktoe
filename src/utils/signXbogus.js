/**
 * Trình sinh chữ ký X-Bogus thuần JavaScript cho TikTok Web API
 * Chạy 100% độc lập trên React Native / Expo mà không cần server hay giả lập
 */
import sign from './xbogus.js';

export function generateXBogus(url, userAgent) {
  try {
    const queryString = url.includes('?') ? url.split('?')[1] : url;
    return sign(queryString, userAgent);
  } catch (err) {
    console.warn('Lỗi sinh X-Bogus:', err);
    return '';
  }
}

export function appendXBogusToUrl(url, userAgent) {
  const xBogus = generateXBogus(url, userAgent);
  if (!xBogus) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}X-Bogus=${xBogus}`;
}
