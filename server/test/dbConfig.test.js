import test from 'node:test';
import assert from 'node:assert/strict';
import { getMongoDatabaseName } from '../src/config/db.js';

test('Mongo database name is explicit and project-scoped', () => {
  const previous = process.env.MONGO_DB_NAME;
  try {
    delete process.env.MONGO_DB_NAME;
    assert.equal(getMongoDatabaseName(), 'roampilot');
    process.env.MONGO_DB_NAME = 'roampilot_test';
    assert.equal(getMongoDatabaseName(), 'roampilot_test');
    process.env.MONGO_DB_NAME = 'bad/database';
    assert.throws(() => getMongoDatabaseName(), /MONGO_DB_NAME/);
  } finally {
    if (previous === undefined) delete process.env.MONGO_DB_NAME;
    else process.env.MONGO_DB_NAME = previous;
  }
});
