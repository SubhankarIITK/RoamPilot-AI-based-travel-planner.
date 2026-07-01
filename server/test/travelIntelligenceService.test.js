import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTravelIntelligenceToPlan,
  collectTravelIntelligence,
  compactTravelIntelligence,
  estimateInterAreaTransfer,
  normalizeGeoapifyPlaces,
  normalizeRouteMatrix,
} from '../src/services/travelIntelligenceService.js';

const createCacheModel = () => ({
  findOne: () => ({ lean: async () => null }),
  findOneAndUpdate: async () => null,
});

test('Geoapify place normalization keeps named coordinates and factual fields', () => {
  const places = normalizeGeoapifyPlaces({
    features: [{
      geometry: { coordinates: [72.831, 18.921] },
      properties: {
        name: 'Chhatrapati Shivaji Maharaj Vastu Sangrahalaya',
        formatted: 'Fort, Mumbai, India',
        categories: ['entertainment.museum'],
        place_id: 'museum-1',
        opening_hours: 'Tu-Su 10:15-18:00',
        website: 'https://csmvs.in/',
      },
    }],
  });

  assert.equal(places.length, 1);
  assert.equal(places[0].type, 'museum');
  assert.equal(places[0].latitude, 18.921);
  assert.equal(places[0].openingHours, 'Tu-Su 10:15-18:00');
});

test('route matrix converts provider units and computes a deterministic nearby order', () => {
  const places = [
    { name: 'A', placeId: 'a' },
    { name: 'B', placeId: 'b' },
    { name: 'C', placeId: 'c' },
  ];
  const matrix = normalizeRouteMatrix({
    durations: [[0, 600, 1800], [600, 0, 300], [1800, 300, 0]],
    distances: [[0, 2000, 9000], [2000, 0, 900], [9000, 900, 0]],
  }, places, 'driving-car');

  assert.deepEqual(matrix.suggestedOrder, ['A', 'B', 'C']);
  assert.equal(matrix.durationsMinutes[0][1], 10);
  assert.equal(matrix.distancesKm[1][2], 0.9);
});

test('inter-area transfer uses geocoding and OpenRouteService instead of invented timing', async () => {
  const previousKey = process.env.OPENROUTESERVICE_API_KEY;
  const previousInterval = process.env.TRAVEL_API_MIN_INTERVAL_MS;
  process.env.OPENROUTESERVICE_API_KEY = 'test-key';
  process.env.TRAVEL_API_MIN_INTERVAL_MS = '0';
  const fetchImpl = async (url, options = {}) => {
    const value = String(url);
    if (value.includes('geocoding-api.open-meteo.com')) {
      const query = new URL(value).searchParams.get('name');
      const pahalgam = /pahalgam/i.test(query);
      return {
        ok: true,
        json: async () => ({
          results: [{
            name: query,
            country: 'India',
            country_code: 'IN',
            latitude: pahalgam ? 34.016 : 34.263,
            longitude: pahalgam ? 75.315 : 74.903,
          }],
        }),
      };
    }
    if (value.includes('/v2/matrix/driving-car')) {
      assert.equal(options.method, 'POST');
      return {
        ok: true,
        json: async () => ({
          durations: [[0, 9000], [9000, 0]],
          distances: [[0, 100000], [100000, 0]],
        }),
      };
    }
    throw new Error(`Unexpected URL: ${value}`);
  };

  try {
    const route = await estimateInterAreaTransfer('Pahalgam', 'Kangan', {
      fetchImpl,
      cacheModel: createCacheModel(),
    });
    assert.equal(route.minutes, 150);
    assert.equal(route.distanceKm, 100);
    assert.equal(route.source, 'OpenRouteService');
  } finally {
    if (previousKey === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
    else process.env.OPENROUTESERVICE_API_KEY = previousKey;
    if (previousInterval === undefined) delete process.env.TRAVEL_API_MIN_INTERVAL_MS;
    else process.env.TRAVEL_API_MIN_INTERVAL_MS = previousInterval;
  }
});

test('API evidence enriches matching itinerary stops and route values', () => {
  const places = [
    { name: 'Gateway of India', placeId: 'gateway', latitude: 18.922, longitude: 72.835, website: 'https://example.com/gateway' },
    { name: 'CSMVS Museum', placeId: 'museum', latitude: 18.927, longitude: 72.832, openingHours: '10:15-18:00' },
  ];
  const evidence = {
    places,
    routeMatrices: {
      walking: {
        placeIds: ['gateway', 'museum'],
        durationsMinutes: [[0, 12], [12, 0]],
        distancesKm: [[0, 0.9], [0.9, 0]],
      },
      driving: null,
    },
    sources: [{ title: 'Geoapify', url: 'https://www.geoapify.com/', note: 'Places' }],
    providerStatus: { geoapify: 'available' },
  };
  const plan = {
    dayWiseItinerary: [{
      schedule: [
        { location: 'Gateway of India', transport: 'Walk' },
        { location: 'CSMVS Museum', transport: 'Walk' },
      ],
    }],
    researchSources: [],
  };

  applyTravelIntelligenceToPlan(plan, evidence);

  assert.equal(plan.dayWiseItinerary[0].schedule[1].travelTime, '12 min (route API)');
  assert.equal(plan.dayWiseItinerary[0].schedule[1].routeDistance, '0.9 km (route API)');
  assert.equal(plan.dayWiseItinerary[0].schedule[1].openingHours, '10:15-18:00');
  assert.equal(plan.factualDataStatus.geoapify, 'available');
  assert.equal(compactTravelIntelligence(evidence).authority.includes('estimated'), true);
});

test('Open-Meteo planning forecast works without any paid provider key', async () => {
  const previous = {
    geoapify: process.env.GEOAPIFY_API_KEY,
    ors: process.env.OPENROUTESERVICE_API_KEY,
  };
  delete process.env.GEOAPIFY_API_KEY;
  delete process.env.OPENROUTESERVICE_API_KEY;

  const fetchImpl = async url => {
    const value = String(url);
    if (value.includes('geocoding-api.open-meteo.com')) {
      return {
        ok: true,
        json: async () => ({
          results: [{
            name: 'Mumbai',
            country: 'India',
            country_code: 'IN',
            latitude: 19.076,
            longitude: 72.8777,
            timezone: 'Asia/Kolkata',
          }],
        }),
      };
    }
    if (value.includes('api.open-meteo.com')) {
      return {
        ok: true,
        json: async () => ({
          timezone: 'Asia/Kolkata',
          daily: {
            time: ['2026-07-02', '2026-07-03'],
            weather_code: [61, 3],
            temperature_2m_max: [31, 32],
            temperature_2m_min: [26, 26],
            precipitation_probability_max: [70, 40],
            precipitation_sum: [5, 1],
            sunrise: ['2026-07-02T06:05', '2026-07-03T06:05'],
            sunset: ['2026-07-02T19:20', '2026-07-03T19:20'],
          },
        }),
      };
    }
    if (value.includes('date.nager.at')) {
      return { ok: true, json: async () => [] };
    }
    throw new Error(`Unexpected URL: ${value}`);
  };

  try {
    const evidence = await collectTravelIntelligence({
      destination: 'Mumbai',
      startDate: '2026-07-02',
      endDate: '2026-07-03',
      travelers: 1,
    }, {
      fetchImpl,
      cacheModel: createCacheModel(),
      now: () => new Date('2026-07-01T08:00:00Z'),
    });

    assert.equal(evidence.providerStatus.geoapify, 'not-configured');
    assert.equal(evidence.providerStatus.openMeteo, 'available');
    assert.equal(evidence.weather.daily.length, 2);
    assert.equal(evidence.weather.daily[0].sunrise, '2026-07-02T06:05');
    const weatherUsage = evidence.providerUsage.find(provider => provider.key === 'open-meteo');
    assert.equal(weatherUsage.status, 'used');
    assert.match(weatherUsage.detail, /2 forecast day/);
  } finally {
    if (previous.geoapify === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = previous.geoapify;
    if (previous.ors === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
    else process.env.OPENROUTESERVICE_API_KEY = previous.ors;
  }
});
