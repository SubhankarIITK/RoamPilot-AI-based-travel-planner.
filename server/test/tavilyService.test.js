import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTavilyResponse,
  getSafeTavilyErrorMessage,
  normalizeTavilyQuery,
} from '../src/services/tavilyService.js';

test('formats Tavily results as bounded research context with safe source URLs', () => {
  const result = formatTavilyResponse({
    answer: 'Current travel summary.',
    request_id: 'request-1',
    results: [
      {
        title: 'Official tourism page',
        url: 'https://example.com/travel',
        content: 'Useful current travel details.',
        score: 0.92,
      },
      {
        title: 'Unsafe link',
        url: 'javascript:alert(1)',
        content: 'This result must be removed.',
        score: 0.99,
      },
    ],
  });

  assert.match(result.content, /Current travel summary/);
  assert.match(result.content, /https:\/\/example\.com\/travel/);
  assert.doesNotMatch(result.content, /javascript:/);
  assert.equal(result.sources.length, 1);
  assert.equal(result.executedTools[0].type, 'tavily_search');
  assert.equal(result.requestId, 'request-1');
});

test('returns empty content when Tavily has no usable answer or sources', () => {
  const result = formatTavilyResponse({ results: [] });
  assert.equal(result.content, '');
  assert.deepEqual(result.sources, []);
});

test('converts Tavily failures into actionable safe workflow messages', () => {
  assert.match(
    getSafeTavilyErrorMessage(new Error('TAVILY_API_KEY not configured')),
    /not configured/,
  );
  assert.match(getSafeTavilyErrorMessage({ status: 429 }), /quota|rate limit/);
  assert.match(getSafeTavilyErrorMessage(new TypeError('fetch failed')), /could not be reached/);
});

test('keeps Tavily search queries below the provider recommendation', () => {
  const query = normalizeTavilyQuery(`  destination\n${'details '.repeat(100)}  `);
  assert.ok(query.length <= 390);
  assert.doesNotMatch(query, /\s{2,}/);
});
