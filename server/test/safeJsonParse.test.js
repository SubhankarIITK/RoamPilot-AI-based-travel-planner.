import test from 'node:test';
import assert from 'node:assert/strict';
import safeJsonParse from '../src/utils/safeJsonParse.js';

test('parses a raw JSON object', () => {
  assert.deepEqual(safeJsonParse('{"ok":true}'), { ok: true });
});

test('parses a raw JSON array', () => {
  assert.deepEqual(safeJsonParse('[{"category":"Documents"}]'), [
    { category: 'Documents' },
  ]);
});

test('parses fenced JSON', () => {
  assert.deepEqual(
    safeJsonParse('```json\n{"days":[{"day":1}]}\n```'),
    { days: [{ day: 1 }] },
  );
});

test('extracts JSON from surrounding text', () => {
  assert.deepEqual(
    safeJsonParse('Result: {"message":"brace } inside string","items":[1,2]} done'),
    { message: 'brace } inside string', items: [1, 2] },
  );
});

test('returns null for invalid content', () => {
  assert.equal(safeJsonParse('not json'), null);
});
