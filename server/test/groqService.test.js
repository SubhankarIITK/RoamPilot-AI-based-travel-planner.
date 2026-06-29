import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateGroqRequestTokens,
  getRetryAfterMs,
  parseGroqDurationMs,
} from '../src/services/groqService.js';

test('parses Groq reset header durations', () => {
  assert.equal(parseGroqDurationMs('7.66s'), 7660);
  assert.equal(parseGroqDurationMs('2m59.56s'), 179560);
  assert.equal(parseGroqDurationMs('250ms'), 250);
});

test('prefers retry-after and token reset headers for rate-limit waits', () => {
  assert.equal(
    getRetryAfterMs({ headers: { 'retry-after': '2' } }),
    2300,
  );
  assert.equal(
    getRetryAfterMs({ headers: { 'x-ratelimit-reset-tokens': '7.66s' } }),
    7960,
  );
});

test('estimates input and maximum output tokens for local pacing', () => {
  const estimated = estimateGroqRequestTokens({
    messages: [{ role: 'user', content: 'a'.repeat(400) }],
    max_tokens: 200,
  });
  assert.equal(estimated, 304);
});
