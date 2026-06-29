import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatPrompt } from '../src/prompts/chatPrompt.js';

test('chat prompt includes compact itinerary context without the full plan payload', () => {
  const messages = buildChatPrompt({
    destination: 'Kolkata',
    aiPlan: {
      summary: 'A balanced culture and food trip.',
      route: ['Central Kolkata'],
      budgetBreakdown: { totalEstimated: 50000 },
      dayWiseItinerary: [{
        day: 2,
        date: '2026-12-02',
        theme: 'Heritage day',
        startArea: 'Esplanade',
        endArea: 'Park Street',
        schedule: [
          { activity: 'Victoria Memorial' },
          { activity: 'Indian Museum' },
        ],
        meals: [{ placeOrArea: 'Mocambo' }],
      }],
    },
  }, [{ role: 'user', content: 'What happens on day 2?' }]);

  assert.match(messages[0].content, /Victoria Memorial/);
  assert.match(messages[0].content, /Mocambo/);
  assert.match(messages[0].content, /totalEstimated/);
  assert.equal(messages[1].content, 'What happens on day 2?');
});
