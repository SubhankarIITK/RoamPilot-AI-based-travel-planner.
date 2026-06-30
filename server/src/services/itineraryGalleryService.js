import { normalizeImageCacheKey, resolveItineraryImage } from './itineraryImageService.js';

const getPlaceName = entry =>
  String(entry?.location || entry?.activity || '').trim().slice(0, 180);

const getImageUniquenessKey = image => {
  const value = image?.pageUrl || image?.url;
  if (!value) return '';
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.toLowerCase();
  } catch {
    return normalizeImageCacheKey(value);
  }
};

export const buildItineraryPlaceGallery = async (
  plan,
  destination,
  {
    resolveImage = resolveItineraryImage,
    seedImages = [],
  } = {},
) => {
  const days = Array.isArray(plan?.dayWiseItinerary) ? plan.dayWiseItinerary : [];
  const records = days.flatMap(day =>
    (Array.isArray(day.schedule) ? day.schedule : []).map((entry, index) => ({
      day: Number(day.day) || 0,
      date: day.date || null,
      theme: day.theme || '',
      order: index,
      placeName: getPlaceName(entry),
      activity: String(entry?.activity || '').trim(),
    })),
  ).filter(record => record.placeName);

  const seededByPlace = new Map(
    seedImages
      .filter(image => image?.placeName && image?.imageUrl)
      .map(image => [
        normalizeImageCacheKey(image.placeName),
        {
          url: image.imageUrl,
          source: 'pexels',
          attributionText: image.imageAttribution || null,
          pageUrl: image.imagePageUrl || null,
        },
      ]),
  );
  const uniqueLookups = new Map();
  for (const record of records) {
    const key = normalizeImageCacheKey(`${record.placeName} ${destination || ''}`);
    if (!uniqueLookups.has(key)) {
      const seeded = seededByPlace.get(normalizeImageCacheKey(record.placeName));
      uniqueLookups.set(
        key,
        seeded ? Promise.resolve(seeded) : resolveImage(record.placeName, destination),
      );
    }
  }
  const resolvedEntries = await Promise.all(
    [...uniqueLookups.entries()].map(async ([key, lookup]) => [key, await lookup]),
  );
  const imagesByKey = new Map(resolvedEntries);
  const usedImageKeys = new Set();

  return days.map(day => {
    const seenPlaces = new Set();
    const places = records
      .filter(record => record.day === Number(day.day))
      .sort((a, b) => a.order - b.order)
      .filter(record => {
        const key = normalizeImageCacheKey(record.placeName);
        if (seenPlaces.has(key)) return false;
        seenPlaces.add(key);
        return true;
      })
      .map(record => {
        const key = normalizeImageCacheKey(`${record.placeName} ${destination || ''}`);
        const image = imagesByKey.get(key);
        const imageKey = getImageUniquenessKey(image);
        const isDuplicateImage = imageKey && usedImageKeys.has(imageKey);
        if (imageKey && !isDuplicateImage) usedImageKeys.add(imageKey);
        return {
          placeName: record.placeName,
          activity: record.activity,
          imageUrl: isDuplicateImage ? null : image?.url || null,
          imageSource: isDuplicateImage ? 'duplicate' : image?.source || 'none',
          imageAttribution: isDuplicateImage ? null : image?.attributionText || null,
          imagePageUrl: isDuplicateImage ? null : image?.pageUrl || null,
        };
      });
    return {
      day: Number(day.day) || 0,
      date: day.date || null,
      theme: day.theme || '',
      places,
    };
  });
};
