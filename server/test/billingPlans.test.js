import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CREDIT_COSTS,
  COMPLETE_TRIAL_CREDITS,
  getCreditPack,
  getPublicCreditPacks,
  getWeeklyFreeCreditAllowance,
} from '../src/config/billingPlans.js';

test('one-time credit packs have positive credits and prices', () => {
  const plans = getPublicCreditPacks();
  assert.equal(plans.length, 3);
  for (const plan of plans) {
    assert.ok(plan.credits > 0);
    assert.ok(plan.displayPrice > 0);
    assert.equal(plan.amountPaise, plan.displayPrice * 100);
  }
});

test('unknown credit packs are rejected by configuration lookup', () => {
  assert.equal(getCreditPack('not-a-pack'), null);
});

test('every metered AI action has a positive integer cost', () => {
  for (const cost of Object.values(AI_CREDIT_COSTS)) {
    assert.ok(Number.isInteger(cost));
    assert.ok(cost > 0);
  }
});

test('weekly free allowance covers every AI action once', () => {
  const expected = Object.values(AI_CREDIT_COSTS).reduce((sum, cost) => sum + cost, 0);
  assert.equal(COMPLETE_TRIAL_CREDITS, expected);
  assert.ok(getWeeklyFreeCreditAllowance() >= expected);
});
