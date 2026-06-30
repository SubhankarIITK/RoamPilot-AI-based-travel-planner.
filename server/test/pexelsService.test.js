import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { getPexelsImage } from '../src/services/pexelsService.js';

const originalApiKey = process.env.PEXELS_API_KEY;

after(() => {
  if (originalApiKey === undefined) delete process.env.PEXELS_API_KEY;
  else process.env.PEXELS_API_KEY = originalApiKey;
});

test('Pexels image lookup returns a normalized photo result', async () => {
  process.env.PEXELS_API_KEY = 'test-key';
  let request;
  const result = await getPexelsImage('Victoria Memorial Kolkata', {
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          photos: [{
            photographer: 'Example Photographer',
            url: 'https://www.pexels.com/photo/123/',
            src: { large: 'https://images.pexels.com/photos/123/large.jpeg' },
          }],
        }),
      };
    },
  });

  assert.match(request.url, /query=Victoria%20Memorial%20Kolkata/);
  assert.equal(request.options.headers.Authorization, 'test-key');
  assert.deepEqual(result, {
    url: 'https://images.pexels.com/photos/123/large.jpeg',
    source: 'pexels',
    attributionText: 'Photo by Example Photographer on Pexels',
    pageUrl: 'https://www.pexels.com/photo/123/',
  });
});

test('Pexels image lookup skips fetch when the API key is missing', async () => {
  delete process.env.PEXELS_API_KEY;
  let called = false;
  const result = await getPexelsImage('Central Park', {
    fetchImpl: async () => {
      called = true;
    },
  });

  assert.equal(result, null);
  assert.equal(called, false);
});

test('Pexels image lookup handles provider rate limits without retrying', async () => {
  process.env.PEXELS_API_KEY = 'test-key';
  let calls = 0;
  const result = await getPexelsImage('Gateway of India', {
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 429 };
    },
  });

  assert.equal(result, null);
  assert.equal(calls, 1);
});

test('Pexels image lookup handles network failures safely', async () => {
  process.env.PEXELS_API_KEY = 'test-key';
  const result = await getPexelsImage('India Gate', {
    fetchImpl: async () => {
      throw new TypeError('fetch failed');
    },
  });
  assert.equal(result, null);
});
