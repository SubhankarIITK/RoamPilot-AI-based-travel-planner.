import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLanguage } from '../src/controllers/transcriptionController.js';

test('speech language normalization accepts browser locales safely', () => {
  assert.equal(normalizeLanguage('en-IN'), 'en');
  assert.equal(normalizeLanguage('HI-in'), 'hi');
  assert.equal(normalizeLanguage('bn'), 'bn');
  assert.equal(normalizeLanguage('not-a-language'), undefined);
  assert.equal(normalizeLanguage(''), undefined);
});
