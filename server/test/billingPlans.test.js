import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_CREDIT_COSTS,
  getBillingPlan,
  getPublicBillingPlans,
  getWeeklyFreeCreditAllowance,
} from '../src/config/billingPlans.js';

test('paid plans have positive monthly allowances and prices', () => {
  const plans = getPublicBillingPlans();
  assert.equal(plans.length, 3);
  for (const plan of plans) {
    assert.ok(plan.monthlyCredits > 0);
    assert.ok(plan.displayPrice > 0);
    assert.equal('stripePriceId' in plan, false);
  }
});

test('unknown plans are rejected by configuration lookup', () => {
  assert.equal(getBillingPlan('not-a-plan'), null);
});

test('every metered AI action has a positive integer cost', () => {
  for (const cost of Object.values(AI_CREDIT_COSTS)) {
    assert.ok(Number.isInteger(cost));
    assert.ok(cost > 0);
  }
});

test('weekly free allowance defaults to a small positive balance', () => {
  assert.equal(getWeeklyFreeCreditAllowance(), 5);
});
