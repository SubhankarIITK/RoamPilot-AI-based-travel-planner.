import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveAIProvider, isAIAvailable } from '../src/services/aiService.js';
import { runWithAIProvider } from '../src/services/aiProviderContext.js';

test('AI provider selection supports explicit and automatic Gemini configuration', async () => {
  const previous = {
    provider: process.env.AI_PROVIDER,
    groq: process.env.GROQ_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };

  try {
    process.env.GROQ_API_KEY = 'groq-test';
    process.env.GEMINI_API_KEY = 'gemini-test';
    process.env.AI_PROVIDER = 'auto';
    assert.equal(getActiveAIProvider(), 'groq');

    delete process.env.GROQ_API_KEY;
    assert.equal(getActiveAIProvider(), 'gemini');
    assert.equal(isAIAvailable(), true);

    process.env.GROQ_API_KEY = 'groq-test';
    process.env.AI_PROVIDER = 'gemini';
    assert.equal(getActiveAIProvider(), 'gemini');

    await runWithAIProvider('groq', async () => {
      await Promise.resolve();
      assert.equal(getActiveAIProvider(), 'groq');
    });

    delete process.env.GEMINI_API_KEY;
    assert.equal(getActiveAIProvider(), null);
    assert.equal(isAIAvailable(), false);
  } finally {
    if (previous.provider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = previous.provider;
    if (previous.groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = previous.groq;
    if (previous.gemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous.gemini;
  }
});
