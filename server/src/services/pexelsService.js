import logger from './logger.js';

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';
const REQUEST_TIMEOUT_MS = 5000;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const SAFE_HOURLY_LIMIT = 180;

let requestTimestamps = [];
let missingKeyWarningLogged = false;
let limitWarningLoggedAt = 0;

const warnForMissingKey = () => {
  if (missingKeyWarningLogged) return;
  missingKeyWarningLogged = true;
  logger.warn(
    { stage: 'PEXELS_IMAGE', reason: 'missing_api_key' },
    'PEXELS_API_KEY is not configured; itinerary galleries will remain empty',
  );
};

const safeHttpUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
};

const reserveRequestSlot = () => {
  const cutoff = Date.now() - HOURLY_WINDOW_MS;
  requestTimestamps = requestTimestamps.filter(timestamp => timestamp > cutoff);
  if (requestTimestamps.length >= SAFE_HOURLY_LIMIT) {
    if (Date.now() - limitWarningLoggedAt > 60000) {
      limitWarningLoggedAt = Date.now();
      logger.warn(
        { stage: 'PEXELS_IMAGE', reason: 'local_hourly_safety_limit' },
        'Pexels image lookup skipped to preserve the free-tier quota',
      );
    }
    return false;
  }
  requestTimestamps.push(Date.now());
  return true;
};

export const isPexelsAvailable = () => Boolean(process.env.PEXELS_API_KEY);

export const getPexelsImage = async (query, { fetchImpl = globalThis.fetch } = {}) => {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    warnForMissingKey();
    return null;
  }
  if (!reserveRequestSlot()) return null;

  const normalizedQuery = String(query || '').trim().replace(/\s+/g, ' ').slice(0, 180);
  if (!normalizedQuery) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(normalizedQuery)}&per_page=1&orientation=landscape`;
    const response = await fetchImpl(url, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
    });
    if (response.status === 429) {
      logger.warn(
        { stage: 'PEXELS_IMAGE', reason: 'provider_rate_limit' },
        'Pexels image quota is temporarily exhausted',
      );
      return null;
    }
    if (!response.ok) return null;

    const data = await response.json();
    const photo = Array.isArray(data?.photos) ? data.photos[0] : null;
    const imageUrl = safeHttpUrl(photo?.src?.large || photo?.src?.medium);
    if (!imageUrl) return null;

    const photographer = String(photo?.photographer || 'Pexels contributor').trim();
    return {
      url: imageUrl,
      source: 'pexels',
      attributionText: `Photo by ${photographer} on Pexels`,
      pageUrl: safeHttpUrl(photo?.url),
    };
  } catch (error) {
    logger.warn(
      { stage: 'PEXELS_IMAGE', reason: error?.name === 'AbortError' ? 'timeout' : 'request_failed' },
      'Pexels image lookup failed safely',
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

// The quota counter is intentionally process-local. Move it to a distributed
// store if RoamPilot is deployed across multiple Node instances.

if (!isPexelsAvailable()) warnForMissingKey();
