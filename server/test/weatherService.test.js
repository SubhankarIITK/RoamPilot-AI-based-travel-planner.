import test from 'node:test';
import assert from 'node:assert/strict';
import { getTripWeather, normalizeWeatherLocation } from '../src/services/weatherService.js';

const createCacheModel = ({ cached = null } = {}) => {
  const writes = [];
  return {
    writes,
    findOne: () => ({ lean: async () => cached }),
    findOneAndUpdate: async (...args) => {
      writes.push(args);
      return args[1].$set;
    },
  };
};

test('weather location normalization trims whitespace and caps length', () => {
  assert.equal(normalizeWeatherLocation('  Mumbai    Maharashtra  '), 'Mumbai Maharashtra');
});

test('weather cache hit skips Open-Meteo requests', async () => {
  const cacheModel = createCacheModel({
    cached: {
      data: {
        provider: 'open-meteo',
        resolvedLocation: 'Mumbai, Maharashtra, India',
        current: { temperatureC: 29 },
        daily: [],
      },
    },
  });
  let fetches = 0;

  const result = await getTripWeather('Mumbai', {
    cacheModel,
    fetchImpl: async () => {
      fetches += 1;
      throw new Error('Should not fetch');
    },
  });

  assert.equal(result.cached, true);
  assert.equal(result.current.temperatureC, 29);
  assert.equal(fetches, 0);
});

test('weather lookup geocodes destination and stores normalized forecast', async () => {
  const cacheModel = createCacheModel();
  const urls = [];
  const fetchImpl = async url => {
    urls.push(String(url));
    if (String(url).includes('geocoding-api.open-meteo.com')) {
      return {
        ok: true,
        json: async () => ({
          results: [{
            name: 'Mumbai',
            admin1: 'Maharashtra',
            country: 'India',
            latitude: 19.076,
            longitude: 72.8777,
            timezone: 'Asia/Kolkata',
          }],
        }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        timezone: 'Asia/Kolkata',
        current: {
          time: '2026-06-30T12:00',
          temperature_2m: 31.4,
          apparent_temperature: 35.2,
          relative_humidity_2m: 79,
          precipitation: 0.3,
          rain: 0.3,
          weather_code: 61,
          wind_speed_10m: 12.4,
        },
        daily: {
          time: ['2026-06-30', '2026-07-01'],
          weather_code: [61, 3],
          temperature_2m_max: [32, 31],
          temperature_2m_min: [27, 26],
          precipitation_probability_max: [70, 55],
        },
      }),
    };
  };

  const result = await getTripWeather('Mumbai', {
    cacheModel,
    fetchImpl,
    now: () => new Date('2026-06-30T06:00:00Z'),
  });

  assert.equal(result.cached, false);
  assert.equal(result.resolvedLocation, 'Mumbai, Maharashtra, India');
  assert.equal(result.current.condition, 'Light rain');
  assert.equal(result.current.tone, 'rain');
  assert.equal(result.daily.length, 2);
  assert.equal(result.daily[0].label, 'Today');
  assert.equal(cacheModel.writes.length, 1);
  assert.equal(urls.length, 2);
});

test('weather lookup returns null when destination cannot be geocoded', async () => {
  const cacheModel = createCacheModel();
  const result = await getTripWeather('Unknown Place', {
    cacheModel,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    }),
  });

  assert.equal(result, null);
  assert.equal(cacheModel.writes.length, 0);
});
