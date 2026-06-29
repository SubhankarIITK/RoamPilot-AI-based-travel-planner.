import test from 'node:test';
import assert from 'node:assert/strict';
import { getSafeAIErrorMessage } from '../src/services/aiErrorService.js';

test('AI errors are converted to stable user-safe progress messages', () => {
  assert.match(getSafeAIErrorMessage({ status: 429 }), /rate limit/);
  assert.match(
    getSafeAIErrorMessage({ status: 413, message: '{"internal":"request_too_large"}' }),
    /oversized request/,
  );
  assert.equal(
    getSafeAIErrorMessage({ message: 'raw provider payload with internals' }),
    'The AI provider is temporarily unavailable.',
  );
});
