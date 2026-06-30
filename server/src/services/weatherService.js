import WeatherCache from '../models/WeatherCache.js';
import logger from './logger.js';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const REQUEST_TIMEOUT_MS = 5000;
const DEFAULT_TTL_MINUTES = 30;

const codeMap = new Map([
  [0, ['Clear sky', 'sunny']],
  [1, ['Mainly clear', 'sunny']],
  [2, ['Partly cloudy', 'cloudy']],
  [3, ['Overcast', 'cloudy']],
  [45, ['Fog', 'fog']],
  [48, ['Rime fog', 'fog']],
  [51, ['Light drizzle', 'rain']],
  [53, ['Drizzle', 'rain']],
  [55, ['Dense drizzle', 'rain']],
  [61, ['Light rain', 'rain']],
  [63, ['Rain', 'rain']],
  [65, ['Heavy rain', 'rain']],
  [71, ['Light snow', 'snow']],
  [73, ['Snow', 'snow']],
  [75, ['Heavy snow', 'snow']],
  [80, ['Light showers', 'rain']],
  [81, ['Showers', 'rain']],
  [82, ['Heavy showers', 'rain']],
  [95, ['Thunderstorm', 'storm']],
  [96, ['Storm with hail', 'storm']],
  [99, ['Heavy storm with hail', 'storm']],
]);

const safeNumber = value => (Number.isFinite(Number(value)) ? Number(value) : null);

const weatherDescription = code => {
  const [label, tone] = codeMap.get(Number(code)) || ['Weather update', 'cloudy'];
  return { label, tone };
};

const fetchJson = async (url, { fetchImpl = globalThis.fetch } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
};

const ttlMinutes = () => {
  const configured = Number(process.env.WEATHER_CACHE_TTL_MINUTES);
  return Number.isFinite(configured) && configured >= 5
    ? Math.min(configured, 240)
    : DEFAULT_TTL_MINUTES;
};

export const normalizeWeatherLocation = value =>
  String(value || '').trim().replace(/\s+/g, ' ').slice(0, 120);

const normalizeWeatherCacheKey = value =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ');

const cacheKeyFor = locationQuery =>
  `weather:${normalizeWeatherCacheKey(locationQuery)}`;

const resolveCoordinates = async (locationQuery, options) => {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(locationQuery)}&count=1&language=en&format=json`;
  const data = await fetchJson(url, options);
  const place = Array.isArray(data?.results) ? data.results[0] : null;
  if (!place) return null;

  return {
    name: place.name,
    admin1: place.admin1 || '',
    country: place.country || '',
    latitude: safeNumber(place.latitude),
    longitude: safeNumber(place.longitude),
    timezone: place.timezone || null,
  };
};

const buildForecastUrl = coordinates => {
  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'rain',
      'weather_code',
      'wind_speed_10m',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
    ].join(','),
    timezone: 'auto',
    forecast_days: '5',
  });
  return `${FORECAST_URL}?${params.toString()}`;
};

const toDailyForecast = forecast => {
  const daily = forecast?.daily || {};
  const times = Array.isArray(daily.time) ? daily.time : [];
  return times.map((date, index) => {
    const description = weatherDescription(daily.weather_code?.[index]);
    return {
      date,
      label: index === 0
        ? 'Today'
        : new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(`${date}T00:00:00`)),
      condition: description.label,
      tone: description.tone,
      maxC: safeNumber(daily.temperature_2m_max?.[index]),
      minC: safeNumber(daily.temperature_2m_min?.[index]),
      precipitationProbability: safeNumber(daily.precipitation_probability_max?.[index]),
    };
  });
};

const formatLocation = coordinates =>
  [coordinates.name, coordinates.admin1, coordinates.country].filter(Boolean).join(', ');

const normalizeWeatherPayload = (locationQuery, coordinates, forecast) => {
  const currentDescription = weatherDescription(forecast?.current?.weather_code);
  return {
    provider: 'open-meteo',
    providerLabel: 'Open-Meteo',
    sourceUrl: 'https://open-meteo.com/',
    locationQuery,
    resolvedLocation: formatLocation(coordinates),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    timezone: forecast?.timezone || coordinates.timezone || null,
    fetchedAt: new Date().toISOString(),
    current: {
      time: forecast?.current?.time || null,
      temperatureC: safeNumber(forecast?.current?.temperature_2m),
      feelsLikeC: safeNumber(forecast?.current?.apparent_temperature),
      humidity: safeNumber(forecast?.current?.relative_humidity_2m),
      precipitationMm: safeNumber(forecast?.current?.precipitation),
      rainMm: safeNumber(forecast?.current?.rain),
      windKph: safeNumber(forecast?.current?.wind_speed_10m),
      weatherCode: safeNumber(forecast?.current?.weather_code),
      condition: currentDescription.label,
      tone: currentDescription.tone,
    },
    daily: toDailyForecast(forecast),
  };
};

export const getTripWeather = async (
  location,
  {
    cacheModel = WeatherCache,
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
  } = {},
) => {
  const locationQuery = normalizeWeatherLocation(location);
  if (!locationQuery) return null;

  const cacheKey = cacheKeyFor(locationQuery);
  try {
    const cached = await cacheModel.findOne({
      cacheKey,
      expiresAt: { $gt: now() },
    }).lean();
    if (cached?.data) return { ...cached.data, cached: true };
  } catch (error) {
    logger.warn(
      { stage: 'WEATHER_CACHE', reason: 'read_failed' },
      'Weather cache read failed; continuing with provider lookup',
    );
  }

  try {
    const coordinates = await resolveCoordinates(locationQuery, { fetchImpl });
    if (coordinates?.latitude == null || coordinates?.longitude == null) return null;

    const forecast = await fetchJson(buildForecastUrl(coordinates), { fetchImpl });
    const payload = normalizeWeatherPayload(locationQuery, coordinates, forecast);
    const expiresAt = new Date(now().getTime() + ttlMinutes() * 60 * 1000);

    try {
      await cacheModel.findOneAndUpdate(
        { cacheKey },
        {
          $set: {
            cacheKey,
            locationQuery,
            provider: 'open-meteo',
            data: payload,
            expiresAt,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      logger.warn(
        { stage: 'WEATHER_CACHE', reason: 'write_failed' },
        'Weather cache write failed; returning live weather without caching',
      );
    }

    return { ...payload, cached: false };
  } catch (error) {
    logger.warn(
      { stage: 'WEATHER_LOOKUP', error: error.message },
      'Weather lookup failed safely',
    );
    return null;
  }
};
