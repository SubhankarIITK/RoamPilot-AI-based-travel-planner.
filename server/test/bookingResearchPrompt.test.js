import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBookingResearchFallback,
  buildBookingResearchMessages,
  normalizeBookingResearchMarkdown,
} from '../src/prompts/bookingResearchPrompt.js';

const trip = {
  origin: 'Kolkata',
  destination: 'Goa',
  startDate: '2026-07-02',
  endDate: '2026-07-05',
  travelers: 2,
  currency: 'INR',
  budget: 60000,
};

const research = {
  content: 'STRUCTURED TRAVEL API DATA: {...}\n\nGENERAL WEB RESEARCH (supporting reference only):\nCurrent train and hotel notes.',
  evidence: {
    providerStatus: { geoapify: 'available', openMeteo: 'available' },
    places: [{
      name: 'Braganza House',
      type: 'museum',
      address: 'Chandor, Goa, India',
    }],
    weather: {
      daily: [{
        date: '2026-07-02',
        minC: 23,
        maxC: 27,
        precipitationProbability: 90,
      }],
    },
    sources: [{
      title: 'Geoapify',
      url: 'https://www.geoapify.com/',
    }],
  },
  sources: [{
    title: 'Geoapify',
    url: 'https://www.geoapify.com/',
  }],
};

test('booking research prompt requires structured markdown and hides raw payloads', () => {
  const messages = buildBookingResearchMessages(
    trip,
    'attractions and advance booking requirements',
    research,
  );
  assert.match(messages[0].content, /compact comparison table/i);
  assert.match(messages[0].content, /Never expose raw JSON/i);
  assert.match(messages[1].content, /Braganza House/);
  assert.doesNotMatch(messages[1].content, /STRUCTURED TRAVEL API DATA/);
});

test('booking research fallback remains readable without model synthesis', () => {
  const fallback = buildBookingResearchFallback(
    trip,
    'attractions and advance booking requirements',
    research,
  );
  assert.match(fallback, /## Current options for Goa/);
  assert.match(fallback, /\| Option \| Type \| Location \| Next action \|/);
  assert.match(fallback, /Braganza House/);
  assert.match(fallback, /\[Geoapify\]/);
  assert.doesNotMatch(fallback, /STRUCTURED TRAVEL API DATA/);
});

test('booking markdown normalization removes fences and common encoding damage', () => {
  const normalized = normalizeBookingResearchMarkdown(
    '```markdown\n## Price â‚¹1000 at 26Â°C\n```',
  );
  assert.equal(normalized, '## Price ₹1000 at 26°C');
});
