import ImageCache from '../models/ImageCache.js';
import logger from './logger.js';
import { getPexelsImage, isPexelsAvailable } from './pexelsService.js';

const POSITIVE_TTL_HOURS = 720;
const NEGATIVE_TTL_HOURS = 24;
const inFlightLookups = new Map();

export const normalizeImageCacheKey = value =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');

const getTtlHours = result => {
  if (!result?.url) return NEGATIVE_TTL_HOURS;
  const configured = Number(process.env.IMAGE_CACHE_TTL_HOURS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, 8760)
    : POSITIVE_TTL_HOURS;
};

const noImage = () => ({
  url: null,
  source: 'none',
  attributionText: null,
  pageUrl: null,
});

export const resolveItineraryImage = async (
  placeName,
  destinationContext,
  {
    cacheModel = ImageCache,
    getImage = getPexelsImage,
    isAvailable = isPexelsAvailable,
  } = {},
) => {
  const normalizedPlace = normalizeImageCacheKey(placeName);
  const normalizedDestination = normalizeImageCacheKey(destinationContext);
  if (!normalizedPlace) return noImage();

  const cacheKey = `img:${normalizedPlace}:${normalizedDestination}`;
  try {
    const cached = await cacheModel.findOne({
      cacheKey,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (cached && (cached.source !== 'none' || cached.failureReason === 'not_found')) {
      return {
        url: cached.url,
        source: cached.source,
        attributionText: cached.attributionText,
        pageUrl: cached.pageUrl,
      };
    }
  } catch (error) {
    logger.warn(
      { stage: 'PEXELS_IMAGE_CACHE', reason: 'read_failed' },
      'Image cache read failed; continuing with a direct lookup',
    );
  }

  // Missing configuration is not a genuine "no photo exists" result and must
  // not poison the 24-hour negative cache before a key is added.
  if (!isAvailable()) return noImage();
  if (inFlightLookups.has(cacheKey)) return inFlightLookups.get(cacheKey);

  const lookup = (async () => {
    let result = noImage();
    try {
      result = await getImage(`${placeName} ${destinationContext || ''}`.trim()) || noImage();
    } catch {
      result = noImage();
    }

    const expiresAt = new Date(Date.now() + getTtlHours(result) * 60 * 60 * 1000);
    try {
      await cacheModel.findOneAndUpdate(
        { cacheKey },
        {
          $set: {
            cacheKey,
            url: result.url,
            source: result.source,
            attributionText: result.attributionText,
            pageUrl: result.pageUrl,
            failureReason: result.url ? null : 'not_found',
            expiresAt,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      logger.warn(
        { stage: 'PEXELS_IMAGE_CACHE', reason: 'write_failed' },
        'Image cache write failed; returning the resolved image without caching',
      );
    }
    return result;
  })();

  inFlightLookups.set(cacheKey, lookup);
  try {
    return await lookup;
  } finally {
    inFlightLookups.delete(cacheKey);
  }
};
