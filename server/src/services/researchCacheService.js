import crypto from 'node:crypto';
import ResearchCache from '../models/ResearchCache.js';

const dateOnly = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

export const buildResearchCacheKey = ({ userId, trip, focus }) => {
  const input = {
    version: 1,
    userId: String(userId || ''),
    tripId: String(trip?._id || ''),
    origin: String(trip?.origin || '').trim().toLowerCase(),
    destination: String(trip?.destination || '').trim().toLowerCase(),
    startDate: dateOnly(trip?.startDate),
    endDate: dateOnly(trip?.endDate),
    travelers: Number(trip?.travelers) || 1,
    budget: Number(trip?.budget) || 0,
    currency: String(trip?.currency || 'INR'),
    travelStyle: String(trip?.travelStyle || ''),
    planningMode: String(trip?.planningMode || ''),
    notes: String(trip?.notes || '').trim().slice(0, 500),
    focus: String(focus || '').trim().toLowerCase().slice(0, 160),
  };
  return crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex');
};

export const getCachedResearch = async ({ userId, trip, focus }) => {
  if (!userId || !trip?._id) return null;
  const cacheKey = buildResearchCacheKey({ userId, trip, focus });
  return ResearchCache.findOne({
    cacheKey,
    userId,
    expiresAt: { $gt: new Date() },
  }).lean();
};

export const saveCachedResearch = async ({
  userId,
  trip,
  focus,
  content,
  toolsUsed,
}) => {
  if (!userId || !trip?._id || !content) return null;
  const configuredHours = Number(process.env.RESEARCH_CACHE_TTL_HOURS);
  const ttlHours = Number.isFinite(configuredHours) && configuredHours > 0
    ? Math.min(72, configuredHours)
    : 6;
  const cacheKey = buildResearchCacheKey({ userId, trip, focus });
  return ResearchCache.findOneAndUpdate(
    { cacheKey, userId },
    {
      cacheKey,
      userId,
      tripId: trip._id,
      destination: String(trip.destination || '').slice(0, 160),
      content: String(content).slice(0, 12000),
      toolsUsed: Math.max(0, Number(toolsUsed) || 0),
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
};
