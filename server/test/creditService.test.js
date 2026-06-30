import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpendableBalance } from '../src/services/creditService.js';

test('purchased credits remain spendable without an active subscription', () => {
  assert.equal(getSpendableBalance({
    status: 'inactive',
    weeklyFreeCreditBalance: 12,
    creditBalance: 60,
  }), 72);
  assert.equal(getSpendableBalance({
    status: 'canceled',
    weeklyFreeCreditBalance: 0,
    creditBalance: 25,
  }), 25);
});
