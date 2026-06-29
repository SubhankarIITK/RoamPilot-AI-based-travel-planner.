import test from 'node:test';
import assert from 'node:assert/strict';
import { needsLiveTravelResearch } from '../src/services/chatRoutingService.js';

test('chat routing uses web search only for freshness-sensitive questions', () => {
  assert.equal(needsLiveTravelResearch('What is the weather tomorrow?'), true);
  assert.equal(needsLiveTravelResearch('Is Victoria Memorial open now?'), true);
  assert.equal(needsLiveTravelResearch('Check current flight prices'), true);
  assert.equal(needsLiveTravelResearch('Explain my day 2 itinerary'), false);
  assert.equal(needsLiveTravelResearch('Suggest a more relaxed version of day 3'), false);
});
