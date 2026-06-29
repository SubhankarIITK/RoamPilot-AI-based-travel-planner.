import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResearchCacheKey } from '../src/services/researchCacheService.js';

const trip = {
  _id: 'trip-1',
  origin: 'Mumbai',
  destination: 'Kolkata',
  startDate: new Date('2026-12-01'),
  endDate: new Date('2026-12-07'),
  travelers: 4,
  budget: 220000,
  currency: 'INR',
  travelStyle: 'balanced',
  planningMode: 'Hidden Gems',
  notes: 'Vegetarian family trip',
};

test('research cache key is stable and isolated by user and focus', () => {
  const first = buildResearchCacheKey({
    userId: 'user-1',
    trip,
    focus: 'complete trip planning',
  });
  const same = buildResearchCacheKey({
    userId: 'user-1',
    trip: { ...trip },
    focus: 'complete trip planning',
  });
  const otherUser = buildResearchCacheKey({
    userId: 'user-2',
    trip,
    focus: 'complete trip planning',
  });
  const otherFocus = buildResearchCacheKey({
    userId: 'user-1',
    trip,
    focus: 'only current weather',
  });

  assert.equal(first, same);
  assert.notEqual(first, otherUser);
  assert.notEqual(first, otherFocus);
});
