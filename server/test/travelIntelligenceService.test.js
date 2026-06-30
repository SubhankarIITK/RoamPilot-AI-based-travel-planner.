import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTravelIntelligenceToPlan,
  collectTravelIntelligence,
  compactTravelIntelligence,
  normalizeAmadeusOffers,
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

test('Amadeus normalization preserves carrier names, duration, stops, and total quote', () => {
  const offers = normalizeAmadeusOffers({
    dictionaries: { carriers: { AI: 'Air India' } },
    data: [{
      numberOfBookableSeats: 4,
      price: { currency: 'INR', grandTotal: '24500.00' },
      itineraries: [{
        duration: 'PT2H35M',
        segments: [{
          carrierCode: 'AI',
          departure: { iataCode: 'CCU', at: '2026-09-01T10:00:00' },
          arrival: { iataCode: 'BOM', at: '2026-09-01T12:35:00' },
        }],
      }],
    }],
  });

  assert.equal(offers[0].durationMinutes, 155);
  assert.equal(offers[0].totalPrice, 24500);
  assert.deepEqual(offers[0].airlines, ['Air India']);
  assert.equal(offers[0].stops, 0);
});

test('API evidence enriches matching itinerary stops and replaces flight guesses', () => {
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
    flights: {
      offers: [{
        from: 'CCU',
        to: 'BOM',
        airlines: ['Air India'],
        stops: 0,
        currency: 'INR',
        totalPrice: 24500,
        durationMinutes: 155,
      }],
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
    flightSuggestions: [{ airlineOrRoute: 'Invented flight' }],
    researchSources: [],
  };

  applyTravelIntelligenceToPlan(plan, evidence);

  assert.equal(plan.dayWiseItinerary[0].schedule[1].travelTime, '12 min (route API)');
  assert.equal(plan.dayWiseItinerary[0].schedule[1].routeDistance, '0.9 km (route API)');
  assert.equal(plan.dayWiseItinerary[0].schedule[1].openingHours, '10:15-18:00');
  assert.match(plan.flightSuggestions[0].airlineOrRoute, /Air India/);
  assert.equal(plan.factualDataStatus.geoapify, 'available');
  assert.equal(compactTravelIntelligence(evidence).authority.includes('estimated'), true);
});

test('Open-Meteo planning forecast works without any paid provider key', async () => {
  const previous = {
    geoapify: process.env.GEOAPIFY_API_KEY,
    ors: process.env.OPENROUTESERVICE_API_KEY,
    amadeusId: process.env.AMADEUS_CLIENT_ID,
    amadeusSecret: process.env.AMADEUS_CLIENT_SECRET,
  };
  delete process.env.GEOAPIFY_API_KEY;
  delete process.env.OPENROUTESERVICE_API_KEY;
  delete process.env.AMADEUS_CLIENT_ID;
  delete process.env.AMADEUS_CLIENT_SECRET;

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
  } finally {
    if (previous.geoapify === undefined) delete process.env.GEOAPIFY_API_KEY;
    else process.env.GEOAPIFY_API_KEY = previous.geoapify;
    if (previous.ors === undefined) delete process.env.OPENROUTESERVICE_API_KEY;
    else process.env.OPENROUTESERVICE_API_KEY = previous.ors;
    if (previous.amadeusId === undefined) delete process.env.AMADEUS_CLIENT_ID;
    else process.env.AMADEUS_CLIENT_ID = previous.amadeusId;
    if (previous.amadeusSecret === undefined) delete process.env.AMADEUS_CLIENT_SECRET;
    else process.env.AMADEUS_CLIENT_SECRET = previous.amadeusSecret;
  }
});
