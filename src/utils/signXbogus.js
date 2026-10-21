/**
 * Pure JavaScript X-Bogus signature generator for TikTok Web API
 * Runs 100% standalone inside React Native / Expo without external backend dependencies
 */
import sign from './xbogus.js';

export function generateXBogus(url, userAgent) {
  try {
    const queryString = url.includes('?') ? url.split('?')[1] : url;
    return sign(queryString, userAgent);
  } catch (err) {
    console.warn('Failed to generate X-Bogus signature:', err);
    return '';
  }
}

export function appendXBogusToUrl(url, userAgent) {
  const xBogus = generateXBogus(url, userAgent);
  if (!xBogus) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}X-Bogus=${xBogus}`;
}
