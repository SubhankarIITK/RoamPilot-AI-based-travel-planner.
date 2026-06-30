import { createHash } from 'node:crypto';
import {
  normalizeImageCacheKey,
  resolveItineraryImage,
} from './itineraryImageService.js';

const DEFAULT_CARD_IMAGE_LIMIT = 6;

const getImageLimit = () => {
  const configured = Number(process.env.TRIP_CARD_IMAGE_LIMIT);
  return Number.isInteger(configured) && configured > 0
    ? Math.min(10, configured)
    : DEFAULT_CARD_IMAGE_LIMIT;
};

export const selectTripCardPlaces = (plan, limit = getImageLimit()) => {
  const days = Array.isArray(plan?.dayWiseItinerary) ? plan.dayWiseItinerary : [];
  const byDay = days.map(day =>
    (Array.isArray(day.schedule) ? day.schedule : [])
      .map(entry => String(entry?.location || entry?.activity || '').trim().slice(0, 180))
      .filter(Boolean),
  );
  const candidates = [
    ...byDay.map(places => places[0]).filter(Boolean),
    ...byDay.flat(),
  ];
  const seen = new Set();
  return candidates.filter(place => {
    const key = normalizeImageCacheKey(place);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
};

export const getTripCardImageSignature = (places, destination) =>
  createHash('sha256')
    .update(JSON.stringify({
      destination: normalizeImageCacheKey(destination),
      places: places.map(normalizeImageCacheKey),
    }))
    .digest('hex');

export const buildTripCardImageSet = async (
  plan,
  destination,
  { resolveImage = resolveItineraryImage } = {},
) => {
  const places = selectTripCardPlaces(plan);
  if (!places.length) return { signature: '', images: [] };

  const signature = getTripCardImageSignature(places, destination);
  const resolved = await Promise.all(
    places.map(async placeName => ({
      placeName,
      image: await resolveImage(placeName, destination),
    })),
  );
  const images = resolved
    .filter(item => item.image?.url)
    .map(item => ({
      placeName: item.placeName,
      imageUrl: item.image.url,
      imageAttribution: item.image.attributionText || null,
      imagePageUrl: item.image.pageUrl || null,
    }));
  return { signature, images };
};
