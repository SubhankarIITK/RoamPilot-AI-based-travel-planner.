import test from 'node:test';
import assert from 'node:assert/strict';
import { getCreditExemptEmails, isCreditExemptUser } from '../src/config/creditAccess.js';

test('credit exemption allowlist is case-insensitive and supports multiple admins', () => {
  const previous = process.env.CREDIT_EXEMPT_EMAILS;
  process.env.CREDIT_EXEMPT_EMAILS = 'Admin@Example.com, second@example.com';
  try {
    assert.equal(getCreditExemptEmails().size, 2);
    assert.equal(isCreditExemptUser({ email: 'admin@example.com' }), true);
    assert.equal(isCreditExemptUser({ email: 'SECOND@EXAMPLE.COM' }), true);
    assert.equal(isCreditExemptUser({ email: 'traveler@example.com' }), false);
  } finally {
    if (previous === undefined) delete process.env.CREDIT_EXEMPT_EMAILS;
    else process.env.CREDIT_EXEMPT_EMAILS = previous;
  }
});
