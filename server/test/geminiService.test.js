import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGeminiRequest, callGemini } from '../src/services/geminiService.js';

test('Gemini request maps chat roles and JSON output settings', () => {
  const request = buildGeminiRequest([
    { role: 'system', content: 'Return concise output.' },
    { role: 'user', content: 'Build a plan.' },
    { role: 'assistant', content: 'Previous answer.' },
  ], {
    max_tokens: 900,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  assert.equal(request.systemInstruction.parts[0].text, 'Return concise output.');
  assert.deepEqual(request.contents.map(item => item.role), ['user', 'model']);
  assert.equal(request.generationConfig.maxOutputTokens, 900);
  assert.equal(request.generationConfig.responseMimeType, 'application/json');
  assert.equal(request.generationConfig.thinkingConfig.thinkingBudget, 0);
});

test('Gemini call returns candidate text without exposing the key in the URL', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousInterval = process.env.GEMINI_MIN_INTERVAL_MS;
  const originalFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-secret-key';
  process.env.GEMINI_MIN_INTERVAL_MS = '0';
  let requestUrl = '';
  let requestHeaders;
  global.fetch = async (url, options) => {
    requestUrl = String(url);
    requestHeaders = options.headers;
    return {
      ok: true,
      json: async () => ({
        candidates: [{
          finishReason: 'STOP',
          content: { parts: [{ text: '{"ok":true}' }] },
        }],
      }),
    };
  };

  try {
    const result = await callGemini(
      [{ role: 'user', content: 'Return JSON' }],
      { response_format: { type: 'json_object' }, retries: 0 },
    );
    assert.equal(result, '{"ok":true}');
    assert.doesNotMatch(requestUrl, /test-secret-key/);
    assert.equal(requestHeaders['x-goog-api-key'], 'test-secret-key');
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    if (previousInterval === undefined) delete process.env.GEMINI_MIN_INTERVAL_MS;
    else process.env.GEMINI_MIN_INTERVAL_MS = previousInterval;
  }
});
