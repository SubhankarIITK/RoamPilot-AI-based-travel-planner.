import crypto from 'node:crypto';
import TravelDataCache from '../models/TravelDataCache.js';
import logger from './logger.js';

const GEOAPIFY_GEOCODE_URL = 'https://api.geoapify.com/v1/geocode/search';
const GEOAPIFY_PLACES_URL = 'https://api.geoapify.com/v2/places';
const ORS_URL = 'https://api.openrouteservice.org';
const AMADEUS_URL = 'https://test.api.amadeus.com';
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const NAGER_URL = 'https://date.nager.at/api/v3/PublicHolidays';
const DEFAULT_TIMEOUT_MS = 9000;

const providerQueues = new Map();
const providerLastRequest = new Map();
let amadeusToken = null;

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const number = value => (Number.isFinite(Number(value)) ? Number(value) : null);
const round = (value, digits = 1) => {
  const numeric = number(value);
  if (numeric == null) return null;
  const scale = 10 ** digits;
  return Math.round(numeric * scale) / scale;
};
const clean = (value, limit = 180) =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, limit);
const dateOnly = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const safeUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};
const normalizeName = value =>
  clean(value, 200).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const boundedEnvNumber = (name, fallback, minimum, maximum) => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
};

const queueProviderCall = (provider, operation) => {
  const previous = providerQueues.get(provider) || Promise.resolve();
  const run = previous.then(async () => {
    const minInterval = boundedEnvNumber(
      'TRAVEL_API_MIN_INTERVAL_MS',
      300,
      0,
      5000,
    );
    const elapsed = Date.now() - (providerLastRequest.get(provider) || 0);
    if (elapsed < minInterval) await wait(minInterval - elapsed);
    providerLastRequest.set(provider, Date.now());
    return operation();
  });
  providerQueues.set(provider, run.catch(() => {}));
  return run;
};

const fetchJson = async (
  url,
  {
    provider,
    method = 'GET',
    headers = {},
    body,
    fetchImpl = globalThis.fetch,
  },
) => queueProviderCall(provider, async () => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    boundedEnvNumber('TRAVEL_API_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, 3000, 20000),
  );
  try {
    const response = await fetchImpl(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = new Error(`${provider} returned HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
});

const cacheKeyFor = (provider, input) => crypto
  .createHash('sha256')
  .update(`${provider}:${JSON.stringify(input)}`)
  .digest('hex');

const withProviderCache = async ({
  provider,
  input,
  ttlHours,
  load,
  cacheModel = TravelDataCache,
  now = () => new Date(),
}) => {
  const cacheKey = cacheKeyFor(provider, input);
  try {
    const cached = await cacheModel.findOne({
      cacheKey,
      expiresAt: { $gt: now() },
    }).lean();
    if (cached?.data) return { data: cached.data, cached: true };
  } catch {
    logger.warn({ stage: 'TRAVEL_DATA_CACHE', provider }, 'Travel data cache read failed');
  }

  const data = await load();
  if (data == null) return { data: null, cached: false };
  try {
    await cacheModel.findOneAndUpdate(
      { cacheKey },
      {
        $set: {
          cacheKey,
          provider,
          data,
          expiresAt: new Date(now().getTime() + ttlHours * 60 * 60 * 1000),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  } catch {
    logger.warn({ stage: 'TRAVEL_DATA_CACHE', provider }, 'Travel data cache write failed');
  }
  return { data, cached: false };
};

const safeProvider = async (provider, operation) => {
  try {
    return await operation();
  } catch (error) {
    logger.warn(
      { stage: 'TRAVEL_INTELLIGENCE', provider, status: error?.status },
      `${provider} lookup failed safely`,
    );
    return null;
  }
};

const geoapifyLocation = async (query, dependencies) => {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey || !query) return null;
  const input = { query: clean(query).toLowerCase() };
  return withProviderCache({
    provider: 'geoapify-geocode',
    input,
    ttlHours: 24 * 30,
    ...dependencies,
    load: async () => {
      const params = new URLSearchParams({
        text: clean(query),
        format: 'json',
        limit: '1',
        lang: 'en',
        apiKey,
      });
      const response = await fetchJson(`${GEOAPIFY_GEOCODE_URL}?${params}`, {
        provider: 'geoapify',
        fetchImpl: dependencies.fetchImpl,
      });
      const place = response?.results?.[0];
      if (!place) return null;
      return {
        name: clean(place.name || place.city || query),
        formatted: clean(place.formatted),
        city: clean(place.city || place.name),
        country: clean(place.country),
        countryCode: clean(place.country_code, 2).toUpperCase(),
        latitude: number(place.lat),
        longitude: number(place.lon),
        placeId: clean(place.place_id, 200),
        timezone: clean(place.timezone?.name || place.timezone, 80),
      };
    },
  });
};

const openMeteoLocation = async (query, dependencies) => {
  if (!query) return null;
  const input = { query: clean(query).toLowerCase() };
  return withProviderCache({
    provider: 'open-meteo-geocode',
    input,
    ttlHours: 24 * 30,
    ...dependencies,
    load: async () => {
      const params = new URLSearchParams({
        name: clean(query),
        count: '1',
        language: 'en',
        format: 'json',
      });
      const response = await fetchJson(`${OPEN_METEO_GEOCODE_URL}?${params}`, {
        provider: 'open-meteo',
        fetchImpl: dependencies.fetchImpl,
      });
      const place = response?.results?.[0];
      return place ? {
        name: clean(place.name || query),
        formatted: clean([place.name, place.admin1, place.country].filter(Boolean).join(', ')),
        city: clean(place.name),
        country: clean(place.country),
        countryCode: clean(place.country_code, 2).toUpperCase(),
        latitude: number(place.latitude),
        longitude: number(place.longitude),
        placeId: '',
        timezone: clean(place.timezone, 80),
        coordinateSource: 'Open-Meteo geocoding',
      } : null;
    },
  });
};

const placeType = categories => {
  const joined = (categories || []).join(' ');
  if (/accommodation/.test(joined)) return 'hotel';
  if (/catering\.restaurant/.test(joined)) return 'restaurant';
  if (/catering\.cafe/.test(joined)) return 'cafe';
  if (/museum/.test(joined)) return 'museum';
  if (/park|garden|nature/.test(joined)) return 'park';
  return 'attraction';
};

export const normalizeGeoapifyPlaces = response => (response?.features || [])
  .map(feature => {
    const properties = feature?.properties || {};
    const coordinates = feature?.geometry?.coordinates || [];
    const name = clean(properties.name || properties.address_line1);
    if (!name) return null;
    return {
      name,
      type: placeType(properties.categories),
      address: clean(properties.formatted || properties.address_line2),
      latitude: number(properties.lat ?? coordinates[1]),
      longitude: number(properties.lon ?? coordinates[0]),
      placeId: clean(properties.place_id, 200),
      openingHours: clean(
        properties.opening_hours ||
        properties.datasource?.raw?.opening_hours,
        220,
      ),
      website: safeUrl(
        properties.website ||
        properties.datasource?.raw?.website ||
        properties.datasource?.raw?.contact_website,
      ),
      categories: (properties.categories || []).slice(0, 5),
    };
  })
  .filter(place => place?.latitude != null && place?.longitude != null)
  .filter((place, index, places) =>
    places.findIndex(candidate => normalizeName(candidate.name) === normalizeName(place.name)) === index)
  .slice(0, 30);

const geoapifyPlaces = async (location, dependencies) => {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey || location?.latitude == null || location?.longitude == null) return null;
  const radius = boundedEnvNumber('GEOAPIFY_SEARCH_RADIUS_METERS', 15000, 3000, 30000);
  const input = {
    latitude: round(location.latitude, 4),
    longitude: round(location.longitude, 4),
    radius,
  };
  return withProviderCache({
    provider: 'geoapify-places',
    input,
    ttlHours: 24 * 7,
    ...dependencies,
    load: async () => {
      const params = new URLSearchParams({
        categories: [
          'accommodation.hotel',
          'catering.restaurant',
          'catering.cafe',
          'tourism.attraction',
          'entertainment.museum',
          'leisure.park',
        ].join(','),
        conditions: 'named',
        filter: `circle:${location.longitude},${location.latitude},${radius}`,
        bias: `proximity:${location.longitude},${location.latitude}`,
        limit: '30',
        lang: 'en',
        apiKey,
      });
      return normalizeGeoapifyPlaces(await fetchJson(`${GEOAPIFY_PLACES_URL}?${params}`, {
        provider: 'geoapify',
        fetchImpl: dependencies.fetchImpl,
      }));
    },
  });
};

const selectRoutePlaces = places => {
  const selected = [];
  const limits = { attraction: 4, museum: 2, park: 2, restaurant: 1, cafe: 1 };
  Object.entries(limits).forEach(([type, limit]) => {
    selected.push(...places.filter(place => place.type === type).slice(0, limit));
  });
  return selected
    .filter((place, index, all) => all.findIndex(item => item.placeId === place.placeId) === index)
    .slice(0, 10);
};

const nearestNeighborOrder = matrix => {
  if (!Array.isArray(matrix) || matrix.length < 2) return [];
  const remaining = new Set(Array.from({ length: matrix.length - 1 }, (_, index) => index + 1));
  const order = [0];
  while (remaining.size) {
    const current = order.at(-1);
    let next = null;
    let best = Infinity;
    remaining.forEach(candidate => {
      const value = number(matrix[current]?.[candidate]);
      if (value != null && value < best) {
        best = value;
        next = candidate;
      }
    });
    if (next == null) next = remaining.values().next().value;
    order.push(next);
    remaining.delete(next);
  }
  return order;
};

export const normalizeRouteMatrix = (response, places, profile) => {
  const durations = (response?.durations || []).map(row =>
    row.map(value => (value == null ? null : round(value / 60, 0))));
  const distances = (response?.distances || []).map(row =>
    row.map(value => (value == null ? null : round(value / 1000, 1))));
  const order = nearestNeighborOrder(response?.durations || []);
  return {
    profile,
    placeIds: places.map(place => place.placeId),
    placeNames: places.map(place => place.name),
    durationsMinutes: durations,
    distancesKm: distances,
    suggestedOrder: order.map(index => places[index]?.name).filter(Boolean),
  };
};

const routeMatrix = async (places, profile, dependencies) => {
  const apiKey = process.env.OPENROUTESERVICE_API_KEY;
  if (!apiKey || places.length < 2) return null;
  const input = { profile, placeIds: places.map(place => place.placeId) };
  return withProviderCache({
    provider: `openrouteservice-${profile}`,
    input,
    ttlHours: 24 * 7,
    ...dependencies,
    load: async () => {
      const response = await fetchJson(`${ORS_URL}/v2/matrix/${profile}`, {
        provider: 'openrouteservice',
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          locations: places.map(place => [place.longitude, place.latitude]),
          metrics: ['distance', 'duration'],
          units: 'm',
        }),
        fetchImpl: dependencies.fetchImpl,
      });
      return normalizeRouteMatrix(response, places, profile);
    },
  });
};

const amadeusAccessToken = async fetchImpl => {
  if (amadeusToken?.expiresAt > Date.now() + 60000) return amadeusToken.value;
  const clientId = process.env.AMADEUS_CLIENT_ID;
  const clientSecret = process.env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });
  const response = await fetchJson(`${AMADEUS_URL}/v1/security/oauth2/token`, {
    provider: 'amadeus',
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
    fetchImpl,
  });
  if (!response?.access_token) return null;
  amadeusToken = {
    value: response.access_token,
    expiresAt: Date.now() + Math.max(300, Number(response.expires_in) || 1200) * 1000,
  };
  return amadeusToken.value;
};

const amadeusAirport = async (query, token, dependencies) => {
  if (!query || !token) return null;
  const keyword = clean(query.split(',')[0], 40);
  if (keyword.length < 2) return null;
  return withProviderCache({
    provider: 'amadeus-airport',
    input: { keyword: keyword.toLowerCase() },
    ttlHours: 24 * 30,
    ...dependencies,
    load: async () => {
      const params = new URLSearchParams({
        subType: 'CITY,AIRPORT',
        keyword,
        view: 'LIGHT',
        'page[limit]': '5',
      });
      const response = await fetchJson(`${AMADEUS_URL}/v1/reference-data/locations?${params}`, {
        provider: 'amadeus',
        headers: { Authorization: `Bearer ${token}` },
        fetchImpl: dependencies.fetchImpl,
      });
      const result = response?.data?.find(item => item.iataCode) || response?.data?.[0];
      return result ? {
        iataCode: clean(result.iataCode, 3),
        name: clean(result.name),
        cityName: clean(result.address?.cityName),
        countryCode: clean(result.address?.countryCode, 2),
        subType: clean(result.subType, 20),
      } : null;
    },
  });
};

const isoDurationMinutes = value => {
  const match = String(value || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  return match ? Number(match[1] || 0) * 60 + Number(match[2] || 0) : null;
};

export const normalizeAmadeusOffers = response => {
  const carriers = response?.dictionaries?.carriers || {};
  return (response?.data || []).slice(0, 4).map(offer => {
    const itinerary = offer.itineraries?.[0] || {};
    const segments = itinerary.segments || [];
    const carrierCodes = [...new Set(segments.map(segment => segment.carrierCode).filter(Boolean))];
    return {
      from: clean(segments[0]?.departure?.iataCode, 3),
      to: clean(segments.at(-1)?.arrival?.iataCode, 3),
      departureAt: clean(segments[0]?.departure?.at, 40),
      arrivalAt: clean(segments.at(-1)?.arrival?.at, 40),
      durationMinutes: isoDurationMinutes(itinerary.duration),
      stops: Math.max(0, segments.length - 1),
      airlines: carrierCodes.map(code => carriers[code] || code),
      carrierCodes,
      currency: clean(offer.price?.currency, 3),
      totalPrice: number(offer.price?.grandTotal || offer.price?.total),
      seatsRemaining: number(offer.numberOfBookableSeats),
      source: 'Amadeus Self-Service test data',
    };
  }).filter(offer => offer.from && offer.to && offer.totalPrice != null);
};

const amadeusFlights = async (trip, dependencies) => {
  if (!process.env.AMADEUS_CLIENT_ID || !process.env.AMADEUS_CLIENT_SECRET) return null;
  const departureDate = dateOnly(trip.startDate);
  if (!departureDate || new Date(`${departureDate}T23:59:59Z`) < new Date()) return null;
  const token = await amadeusAccessToken(dependencies.fetchImpl);
  if (!token) return null;
  const [originResult, destinationResult] = await Promise.all([
    amadeusAirport(trip.origin, token, dependencies),
    amadeusAirport(trip.destination, token, dependencies),
  ]);
  const origin = originResult?.data || null;
  const destination = destinationResult?.data || null;
  if (!origin?.iataCode || !destination?.iataCode) {
    return { origin, destination, offers: [] };
  }

  const adults = Math.min(9, Math.max(1, Number(trip.travelers) || 1));
  const returnDate = dateOnly(trip.endDate);
  const input = {
    origin: origin.iataCode,
    destination: destination.iataCode,
    departureDate,
    returnDate: returnDate > departureDate ? returnDate : '',
    adults,
    currency: clean(trip.currency || 'INR', 3).toUpperCase(),
  };
  const offers = await withProviderCache({
    provider: 'amadeus-flight-offers',
    input,
    ttlHours: 6,
    ...dependencies,
    load: async () => {
      const params = new URLSearchParams({
        originLocationCode: input.origin,
        destinationLocationCode: input.destination,
        departureDate,
        adults: String(adults),
        currencyCode: input.currency,
        max: '4',
      });
      if (input.returnDate) params.set('returnDate', input.returnDate);
      const response = await fetchJson(`${AMADEUS_URL}/v2/shopping/flight-offers?${params}`, {
        provider: 'amadeus',
        headers: { Authorization: `Bearer ${token}` },
        fetchImpl: dependencies.fetchImpl,
      });
      return normalizeAmadeusOffers(response);
    },
  });
  return { origin, destination, offers: offers.data || [], cached: offers.cached };
};

const weatherForTrip = async (trip, location, dependencies) => {
  if (location?.latitude == null || location?.longitude == null) return null;
  const startDate = dateOnly(trip.startDate);
  const endDate = dateOnly(trip.endDate);
  if (!startDate || !endDate) return null;
  const today = dependencies.now();
  today.setUTCHours(0, 0, 0, 0);
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const horizon = new Date(today.getTime() + 15 * 86400000);
  if (start < today || start > horizon) {
    return { kind: 'outside-live-forecast-window', daily: [] };
  }
  const boundedEnd = end > horizon ? horizon : end;
  const input = {
    latitude: round(location.latitude, 3),
    longitude: round(location.longitude, 3),
    startDate,
    endDate: dateOnly(boundedEnd),
  };
  return withProviderCache({
    provider: 'open-meteo-trip',
    input,
    ttlHours: 6,
    ...dependencies,
    load: async () => {
      const params = new URLSearchParams({
        latitude: String(location.latitude),
        longitude: String(location.longitude),
        start_date: input.startDate,
        end_date: input.endDate,
        daily: [
          'weather_code',
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_probability_max',
          'precipitation_sum',
          'sunrise',
          'sunset',
        ].join(','),
        timezone: 'auto',
      });
      const response = await fetchJson(`${OPEN_METEO_URL}?${params}`, {
        provider: 'open-meteo',
        fetchImpl: dependencies.fetchImpl,
      });
      return {
        kind: 'live-forecast',
        timezone: clean(response?.timezone, 80),
        daily: (response?.daily?.time || []).map((date, index) => ({
          date,
          maxC: number(response.daily.temperature_2m_max?.[index]),
          minC: number(response.daily.temperature_2m_min?.[index]),
          precipitationProbability: number(
            response.daily.precipitation_probability_max?.[index],
          ),
          precipitationMm: number(response.daily.precipitation_sum?.[index]),
          sunrise: clean(response.daily.sunrise?.[index], 40),
          sunset: clean(response.daily.sunset?.[index], 40),
          weatherCode: number(response.daily.weather_code?.[index]),
        })),
      };
    },
  });
};

const publicHolidays = async (trip, countryCode, dependencies) => {
  const startDate = dateOnly(trip.startDate);
  const endDate = dateOnly(trip.endDate);
  if (!countryCode || !startDate || !endDate) return null;
  const year = Number(startDate.slice(0, 4));
  return withProviderCache({
    provider: 'nager-holidays',
    input: { year, countryCode },
    ttlHours: 24 * 7,
    ...dependencies,
    load: async () => {
      const response = await fetchJson(`${NAGER_URL}/${year}/${countryCode}`, {
        provider: 'nager',
        fetchImpl: dependencies.fetchImpl,
      });
      return (Array.isArray(response) ? response : [])
        .filter(holiday => holiday.date >= startDate && holiday.date <= endDate)
        .map(holiday => ({
          date: holiday.date,
          name: clean(holiday.name),
          localName: clean(holiday.localName),
          nationwide: holiday.global !== false,
        }));
    },
  });
};

const providerSource = (title, url, note) => ({ title, url, note });

export const collectTravelIntelligence = async (
  trip,
  {
    fetchImpl = globalThis.fetch,
    cacheModel = TravelDataCache,
    now = () => new Date(),
  } = {},
) => {
  const dependencies = { fetchImpl, cacheModel, now };
  const configured = {
    geoapify: !!process.env.GEOAPIFY_API_KEY,
    openRouteService: !!process.env.OPENROUTESERVICE_API_KEY,
    amadeus: !!(process.env.AMADEUS_CLIENT_ID && process.env.AMADEUS_CLIENT_SECRET),
    openMeteo: true,
    nager: true,
  };

  const geoapifyLocationResult = await safeProvider(
    'geoapify',
    () => geoapifyLocation(trip.destination, dependencies),
  );
  const geoapifyResolvedLocation = geoapifyLocationResult?.data || null;
  let locationResult = geoapifyLocationResult;
  if (!locationResult?.data) {
    locationResult = await safeProvider(
      'open-meteo',
      () => openMeteoLocation(trip.destination, dependencies),
    );
  }
  const location = locationResult?.data || null;
  const [placesResult, flightData, weatherResult, holidaysResult] = await Promise.all([
    safeProvider('geoapify', () => geoapifyPlaces(location, dependencies)),
    safeProvider('amadeus', () => amadeusFlights(trip, dependencies)),
    safeProvider('open-meteo', () => weatherForTrip(trip, location, dependencies)),
    safeProvider(
      'nager',
      () => publicHolidays(trip, location?.countryCode, dependencies),
    ),
  ]);

  const places = placesResult?.data || [];
  const routePlaces = selectRoutePlaces(places);
  const [drivingResult, walkingResult] = await Promise.all([
    safeProvider(
      'openrouteservice',
      () => routeMatrix(routePlaces, 'driving-car', dependencies),
    ),
    safeProvider(
      'openrouteservice',
      () => routeMatrix(routePlaces, 'foot-walking', dependencies),
    ),
  ]);

  const providerStatus = {
    geoapify: !configured.geoapify
      ? 'not-configured'
      : geoapifyResolvedLocation ? 'available' : 'unavailable',
    openRouteService: !configured.openRouteService
      ? 'not-configured'
      : drivingResult?.data ? 'available' : 'unavailable',
    amadeus: !configured.amadeus ? 'not-configured' : flightData ? 'available' : 'unavailable',
    openMeteo: weatherResult?.data?.kind === 'live-forecast'
      ? 'available'
      : weatherResult?.kind === 'outside-live-forecast-window' ||
        weatherResult?.data?.kind === 'outside-live-forecast-window'
        ? 'outside-forecast-window'
        : 'unavailable',
    nager: holidaysResult?.data ? 'available' : 'unavailable',
  };
  const sources = [];
  if (geoapifyResolvedLocation || places.length) {
    sources.push(providerSource(
      'Geoapify Places and Geocoding',
      'https://www.geoapify.com/',
      'Named places, categories, addresses, and coordinates',
    ));
  }
  if (drivingResult?.data || walkingResult?.data) {
    sources.push(providerSource(
      'openrouteservice',
      'https://openrouteservice.org/',
      'Road-network distance and duration matrices',
    ));
  }
  if (flightData?.offers?.length) {
    sources.push(providerSource(
      'Amadeus for Developers',
      'https://developers.amadeus.com/',
      'Test-environment flight routes, durations, carriers, and fare quotes',
    ));
  }
  if (weatherResult?.data?.kind === 'live-forecast') {
    sources.push(providerSource(
      'Open-Meteo',
      'https://open-meteo.com/',
      'Date-specific forecast, rain, temperature, sunrise, and sunset',
    ));
  }
  if (holidaysResult?.data?.length) {
    sources.push(providerSource(
      'Nager.Date',
      'https://date.nager.at/',
      'Public holidays during the trip',
    ));
  }

  return {
    version: 1,
    fetchedAt: now().toISOString(),
    location,
    places,
    flights: flightData || { origin: null, destination: null, offers: [] },
    routeMatrices: {
      driving: drivingResult?.data || null,
      walking: walkingResult?.data || null,
    },
    weather: weatherResult?.data || weatherResult || null,
    holidays: holidaysResult?.data || [],
    providerStatus,
    sources,
  };
};

const matrixEdges = matrix => {
  if (!matrix?.suggestedOrder?.length) return [];
  const indexes = new Map(matrix.placeNames.map((name, index) => [name, index]));
  return matrix.suggestedOrder.slice(1).map((to, position) => {
    const from = matrix.suggestedOrder[position];
    const fromIndex = indexes.get(from);
    const toIndex = indexes.get(to);
    return {
      from,
      to,
      minutes: matrix.durationsMinutes?.[fromIndex]?.[toIndex],
      distanceKm: matrix.distancesKm?.[fromIndex]?.[toIndex],
    };
  }).filter(edge => edge.minutes != null);
};

export const compactTravelIntelligence = evidence => {
  if (!evidence) return null;
  return {
    authority: 'Use supplied API facts exactly. Missing facts must be labelled estimated.',
    providerStatus: evidence.providerStatus,
    location: evidence.location,
    flights: (evidence.flights?.offers || []).slice(0, 3),
    places: (evidence.places || []).slice(0, 22).map(place => ({
      name: place.name,
      type: place.type,
      address: place.address,
      coordinates: [place.longitude, place.latitude],
      openingHours: place.openingHours || null,
      website: place.website || null,
      placeId: place.placeId,
    })),
    drivingRouteEvidence: matrixEdges(evidence.routeMatrices?.driving),
    walkingRouteEvidence: matrixEdges(evidence.routeMatrices?.walking),
    suggestedDrivingOrder: evidence.routeMatrices?.driving?.suggestedOrder || [],
    weather: evidence.weather,
    holidays: evidence.holidays || [],
    sources: evidence.sources || [],
  };
};

export const formatTravelIntelligenceForPrompt = evidence => {
  const compact = compactTravelIntelligence(evidence);
  return compact ? JSON.stringify(compact) : '';
};

const findPlace = (value, places) => {
  const target = normalizeName(value);
  if (!target) return null;
  return places.find(place => {
    const candidate = normalizeName(place.name);
    return candidate === target ||
      (candidate.length >= 5 && target.includes(candidate)) ||
      (target.length >= 5 && candidate.includes(target));
  }) || null;
};

const matrixValue = (matrix, fromPlace, toPlace, field) => {
  if (!matrix || !fromPlace || !toPlace) return null;
  const from = matrix.placeIds?.indexOf(fromPlace.placeId);
  const to = matrix.placeIds?.indexOf(toPlace.placeId);
  return from >= 0 && to >= 0 ? matrix[field]?.[from]?.[to] : null;
};

const estimatedClaim = (value, action) => {
  const text = clean(value, 220);
  if (!text || /estimated|route api/i.test(text)) return text;
  return `${text} (estimated; ${action})`;
};

export const applyTravelIntelligenceToPlan = (plan, evidence) => {
  if (!plan || !evidence) return plan;
  const places = evidence.places || [];
  let matchedStops = 0;
  let unmatchedStops = 0;
  let validatedLegs = 0;
  (plan.dayWiseItinerary || []).forEach(day => {
    let previousPlace = null;
    (day.schedule || []).forEach((item, index) => {
      const place = findPlace(item.location || item.activity, places);
      if (!place) {
        unmatchedStops += 1;
        item.factualStatus = 'estimated-place';
        if (!item.sourceUrl) {
          item.openingHours = estimatedClaim(item.openingHours, 'confirm with the venue');
          item.entryFee = estimatedClaim(item.entryFee, 'confirm with the venue');
        }
        if (index > 0) {
          item.travelTime = estimatedClaim(item.travelTime, 'check live traffic');
          item.routeDistance = estimatedClaim(item.routeDistance, 'check the route before departure');
        }
        previousPlace = null;
        return;
      }
      matchedStops += 1;
      item.factualStatus = 'api-verified-place';
      item.placeId = place.placeId;
      item.coordinates = { latitude: place.latitude, longitude: place.longitude };
      if (place.openingHours) item.openingHours = place.openingHours;
      else if (!item.sourceUrl) {
        item.openingHours = estimatedClaim(item.openingHours, 'confirm with the venue');
      }
      if (!item.sourceUrl) {
        item.entryFee = estimatedClaim(item.entryFee, 'confirm with the venue');
      }
      if (place.website) item.sourceUrl = place.website;

      if (previousPlace) {
        const walking = /walk/i.test(String(item.transport || ''));
        const matrix = walking
          ? evidence.routeMatrices?.walking
          : evidence.routeMatrices?.driving;
        const minutes = matrixValue(matrix, previousPlace, place, 'durationsMinutes');
        const distance = matrixValue(matrix, previousPlace, place, 'distancesKm');
        if (minutes != null) item.travelTime = `${Math.max(1, Math.round(minutes))} min (route API)`;
        if (distance != null) item.routeDistance = `${round(distance, 1)} km (route API)`;
        if (minutes != null || distance != null) validatedLegs += 1;
      }
      previousPlace = place;
    });

    (day.meals || []).forEach(meal => {
      const place = findPlace(meal.placeOrArea, places);
      meal.factualStatus = place ? 'api-verified-place' : 'estimated-place';
      if (place) {
        meal.placeId = place.placeId;
        meal.coordinates = { latitude: place.latitude, longitude: place.longitude };
      }
    });
  });

  (plan.hotelSuggestions || []).forEach(hotel => {
    const place = findPlace(hotel.name, places);
    hotel.factualStatus = place ? 'api-verified-place' : 'estimated-place';
    if (place) {
      hotel.placeId = place.placeId;
      hotel.address = place.address;
      hotel.coordinates = { latitude: place.latitude, longitude: place.longitude };
      if (place.website) hotel.bookingLink = place.website;
    }
  });

  (plan.foodPlan || []).forEach(meal => {
    const place = findPlace(meal.restaurantOrArea, places);
    meal.factualStatus = place ? 'api-verified-place' : 'estimated-place';
    if (place) meal.placeId = place.placeId;
  });

  const offers = evidence.flights?.offers || [];
  if (offers.length) {
    plan.flightSuggestions = offers.slice(0, 3).map(offer => ({
      from: offer.from,
      to: offer.to,
      airlineOrRoute: `${offer.airlines.join(', ')} · ${offer.stops === 0 ? 'nonstop' : `${offer.stops} stop(s)`}`,
      estimatedPrice: `${offer.currency} ${offer.totalPrice}`,
      typicalDuration: offer.durationMinutes == null
        ? 'Duration unavailable'
        : `${Math.floor(offer.durationMinutes / 60)} hr ${offer.durationMinutes % 60} min`,
      bookingWindow: 'Amadeus test quote; recheck live inventory before booking',
      sourceUrl: 'https://developers.amadeus.com/',
    }));
  }

  const existingSources = Array.isArray(plan.researchSources) ? plan.researchSources : [];
  plan.researchSources = [...existingSources, ...(evidence.sources || [])]
    .filter((source, index, sources) =>
      source?.url && sources.findIndex(candidate => candidate.url === source.url) === index)
    .slice(0, 12);
  plan.factualDataStatus = evidence.providerStatus;
  plan.routeValidation = {
    provider: 'openrouteservice',
    matchedStops,
    unmatchedStops,
    apiValidatedLegs: validatedLegs,
    note: validatedLegs
      ? 'Matching consecutive place pairs use road-network API values.'
      : 'No consecutive itinerary pair matched the bounded route matrix; displayed route values are estimated.',
  };
  return plan;
};
