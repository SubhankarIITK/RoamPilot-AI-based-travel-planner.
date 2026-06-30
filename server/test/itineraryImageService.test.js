import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeImageCacheKey,
  resolveItineraryImage,
} from '../src/services/itineraryImageService.js';
import { buildItineraryPlaceGallery } from '../src/services/itineraryGalleryService.js';
import {
  buildTripCardImageSet,
  getTripCardImageSignature,
  selectTripCardPlaces,
} from '../src/services/tripCardImageService.js';

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

test('image cache keys normalize case, whitespace, and punctuation', () => {
  assert.equal(normalizeImageCacheKey('  St. Paul’s Cathedral!  '), 'st pauls cathedral');
});

test('itinerary image cache hit skips the Pexels lookup', async () => {
  const cacheModel = createCacheModel({
    cached: {
      url: 'https://images.pexels.com/cached.jpeg',
      source: 'pexels',
      attributionText: 'Cached photo',
      pageUrl: 'https://www.pexels.com/photo/cached/',
    },
  });
  let lookups = 0;
  const result = await resolveItineraryImage('Howrah Bridge', 'Kolkata', {
    cacheModel,
    isAvailable: () => true,
    getImage: async () => {
      lookups += 1;
    },
  });

  assert.equal(result.url, 'https://images.pexels.com/cached.jpeg');
  assert.equal(lookups, 0);
  assert.equal(cacheModel.writes.length, 0);
});

test('itinerary image cache miss stores a successful Pexels result', async () => {
  const cacheModel = createCacheModel();
  const result = await resolveItineraryImage('Marine Drive', 'Mumbai', {
    cacheModel,
    isAvailable: () => true,
    getImage: async query => ({
      url: `https://images.pexels.com/${encodeURIComponent(query)}.jpeg`,
      source: 'pexels',
      attributionText: 'Photo by Tester on Pexels',
      pageUrl: 'https://www.pexels.com/photo/test/',
    }),
  });

  assert.equal(result.source, 'pexels');
  assert.equal(cacheModel.writes.length, 1);
  const stored = cacheModel.writes[0][1].$set;
  assert.equal(stored.source, 'pexels');
  assert.ok(stored.expiresAt.getTime() > Date.now() + 700 * 60 * 60 * 1000);
});

test('missing Pexels result is negatively cached for about 24 hours', async () => {
  const cacheModel = createCacheModel();
  const before = Date.now();
  const result = await resolveItineraryImage('No Photo Place', 'Test City', {
    cacheModel,
    isAvailable: () => true,
    getImage: async () => null,
  });

  assert.equal(result.url, null);
  assert.equal(result.source, 'none');
  const stored = cacheModel.writes[0][1].$set;
  const ttlHours = (stored.expiresAt.getTime() - before) / (60 * 60 * 1000);
  assert.ok(ttlHours >= 23.9 && ttlHours <= 24.1);
});

test('missing Pexels configuration does not create a negative cache entry', async () => {
  const cacheModel = createCacheModel();
  let lookups = 0;
  const result = await resolveItineraryImage('Key Not Configured Place', 'Test City', {
    cacheModel,
    isAvailable: () => false,
    getImage: async () => {
      lookups += 1;
      return null;
    },
  });

  assert.equal(result.source, 'none');
  assert.equal(lookups, 0);
  assert.equal(cacheModel.writes.length, 0);
});

test('gallery groups every unique itinerary place into separate day sections', async () => {
  const plan = {
    dayWiseItinerary: [
      {
        day: 1,
        theme: 'Historic center',
        schedule: [
          { location: 'Victoria Memorial', activity: 'Museum visit' },
          { location: 'Victoria Memorial', activity: 'Garden walk' },
          { location: 'Park Street', activity: 'Dinner' },
        ],
      },
      {
        day: 2,
        theme: 'Riverfront',
        schedule: [{ location: 'Howrah Bridge', activity: 'Sunrise walk' }],
      },
    ],
  };
  const lookups = [];
  const days = await buildItineraryPlaceGallery(plan, 'Kolkata', {
    resolveImage: async placeName => {
      lookups.push(placeName);
      return {
        url: `https://images.pexels.com/${encodeURIComponent(placeName)}.jpeg`,
        source: 'pexels',
        attributionText: 'Photo by Tester on Pexels',
        pageUrl: null,
      };
    },
  });

  assert.equal(days.length, 2);
  assert.deepEqual(days[0].places.map(place => place.placeName), [
    'Victoria Memorial',
    'Park Street',
  ]);
  assert.deepEqual(days[1].places.map(place => place.placeName), ['Howrah Bridge']);
  assert.equal(lookups.length, 3);
});

test('gallery reuses stored trip card images before resolving remaining places', async () => {
  const plan = {
    dayWiseItinerary: [{
      day: 1,
      schedule: [
        { location: 'Victoria Memorial', activity: 'Museum visit' },
        { location: 'Park Street', activity: 'Dinner' },
      ],
    }],
  };
  const lookups = [];
  const days = await buildItineraryPlaceGallery(plan, 'Kolkata', {
    seedImages: [{
      placeName: 'Victoria Memorial',
      imageUrl: 'https://images.pexels.com/stored.jpeg',
      imageAttribution: 'Stored Pexels photo',
      imagePageUrl: 'https://www.pexels.com/photo/stored/',
    }],
    resolveImage: async placeName => {
      lookups.push(placeName);
      return {
        url: 'https://images.pexels.com/new.jpeg',
        source: 'pexels',
        attributionText: 'New Pexels photo',
        pageUrl: null,
      };
    },
  });

  assert.equal(days[0].places[0].imageUrl, 'https://images.pexels.com/stored.jpeg');
  assert.deepEqual(lookups, ['Park Street']);
});

test('gallery suppresses exact duplicate photos across the itinerary', async () => {
  const plan = {
    dayWiseItinerary: [
      {
        day: 1,
        schedule: [{ location: 'Mall Road', activity: 'Walk' }],
      },
      {
        day: 2,
        schedule: [{ location: 'Town Center', activity: 'Cafe hop' }],
      },
    ],
  };
  const duplicatePhoto = {
    url: 'https://images.pexels.com/photos/123/shared.jpeg?auto=compress',
    source: 'pexels',
    attributionText: 'Photo by Tester on Pexels',
    pageUrl: 'https://www.pexels.com/photo/shared-123/',
  };

  const days = await buildItineraryPlaceGallery(plan, 'Manali', {
    resolveImage: async () => duplicatePhoto,
  });

  assert.equal(days[0].places[0].imageUrl, duplicatePhoto.url);
  assert.equal(days[1].places[0].imageUrl, null);
  assert.equal(days[1].places[0].imageSource, 'duplicate');
});

test('trip card images prioritize one distinct place from each itinerary day', () => {
  const plan = {
    dayWiseItinerary: [
      {
        day: 1,
        schedule: [
          { location: 'Victoria Memorial' },
          { location: 'Park Street' },
        ],
      },
      {
        day: 2,
        schedule: [
          { location: 'Howrah Bridge' },
          { location: 'Prinsep Ghat' },
        ],
      },
    ],
  };

  assert.deepEqual(selectTripCardPlaces(plan, 3), [
    'Victoria Memorial',
    'Howrah Bridge',
    'Park Street',
  ]);
});

test('trip card image set stores only successfully resolved plan locations', async () => {
  const plan = {
    dayWiseItinerary: [{
      day: 1,
      schedule: [
        { location: 'India Gate' },
        { location: 'Unavailable Place' },
      ],
    }],
  };
  const result = await buildTripCardImageSet(plan, 'Delhi', {
    resolveImage: async placeName => placeName === 'India Gate'
      ? {
          url: 'https://images.pexels.com/india-gate.jpeg',
          attributionText: 'Photo by Tester on Pexels',
          pageUrl: 'https://www.pexels.com/photo/india-gate/',
        }
      : { url: null },
  });

  assert.equal(result.images.length, 1);
  assert.equal(result.images[0].placeName, 'India Gate');
  assert.equal(result.signature, getTripCardImageSignature(
    ['India Gate', 'Unavailable Place'],
    'Delhi',
  ));
});

test('trip card image signature changes when itinerary locations change', () => {
  const first = getTripCardImageSignature(['India Gate'], 'Delhi');
  const second = getTripCardImageSignature(['Red Fort'], 'Delhi');
  assert.notEqual(first, second);
});
