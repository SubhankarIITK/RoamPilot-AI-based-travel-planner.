const OFFLINE_KEY_PREFIX = 'roampilot:v1:offline-trips:';
const LEGACY_KEYS = ['rp_offline_trips', 'rp_offline_trip'];

const getUserKey = userId => {
  const normalized = String(userId || '').trim();
  return normalized ? `${OFFLINE_KEY_PREFIX}${normalized}` : null;
};

const removeUnsafeLegacyCache = () => {
  // Old entries have no owner identifier, so assigning them to the current
  // account could expose another user's trip. Privacy takes priority over migration.
  LEGACY_KEYS.forEach(key => localStorage.removeItem(key));
};

export const getOfflineTrips = userId => {
  const key = getUserKey(userId);
  if (!key) return [];
  removeUnsafeLegacyCache();
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (!Array.isArray(stored)) return [];
    return stored.filter(trip => String(trip.ownerUserId) === String(userId));
  } catch {
    return [];
  }
};

export const saveOfflineTrip = (trip, userId) => {
  const key = getUserKey(userId);
  if (!key) throw new Error('A signed-in user is required to save an offline trip.');
  const data = {
    ownerUserId: String(userId),
    tripId: trip._id,
    title: trip.title,
    destination: trip.destination,
    itinerary: trip.aiPlan?.dayWiseItinerary || [],
    budgetBreakdown: trip.aiPlan?.budgetBreakdown || {},
    emergencyCard: trip.aiPlan?.emergencyCard || {},
    packingList: trip.aiPlan?.packingList || [],
    safetyTips: trip.aiPlan?.safetyTips || [],
    lastSynced: new Date().toISOString(),
  };
  const trips = getOfflineTrips(userId);
  const next = [data, ...trips.filter(item => item.tripId !== data.tripId)];
  localStorage.setItem(key, JSON.stringify(next));
};

export const getOfflineTrip = userId => getOfflineTrips(userId)[0] || null;

export const clearOfflineTrip = (tripId, userId) => {
  const key = getUserKey(userId);
  if (!key) return;
  if (!tripId) {
    localStorage.removeItem(key);
    return;
  }
  const remaining = getOfflineTrips(userId).filter(trip => trip.tripId !== tripId);
  localStorage.setItem(key, JSON.stringify(remaining));
};
