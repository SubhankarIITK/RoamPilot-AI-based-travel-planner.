import test from 'node:test';
import assert from 'node:assert/strict';
import { isSubscriptionActive } from '../src/services/creditService.js';

const now = new Date('2026-06-29T12:00:00.000Z');

test('subscription access requires active status and a future paid period', () => {
  assert.equal(isSubscriptionActive({
    status: 'active',
    currentPeriodEnd: new Date('2026-07-29T12:00:00.000Z'),
  }, now), true);

  assert.equal(isSubscriptionActive({
    status: 'past_due',
    currentPeriodEnd: new Date('2026-07-29T12:00:00.000Z'),
  }, now), false);

  assert.equal(isSubscriptionActive({
    status: 'active',
    currentPeriodEnd: new Date('2026-06-28T12:00:00.000Z'),
  }, now), false);
});
