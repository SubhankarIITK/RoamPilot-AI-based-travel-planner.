import test from 'node:test';
import assert from 'node:assert/strict';
import User from '../src/models/User.js';
import {
  consumeOtp,
  getOtpCooldownSeconds,
  hashOtp,
  issueOtp,
  OTP_MAX_ATTEMPTS,
} from '../src/services/otpService.js';
import {
  resetPasswordSchema,
  verifyEmailSchema,
} from '../src/schemas/authSchemas.js';
import { isRegisteredVerifiedUser } from '../src/controllers/authController.js';
import { normalizeSmtpPassword } from '../src/services/emailService.js';

const withOtpSecret = async callback => {
  const previous = process.env.OTP_SECRET;
  process.env.OTP_SECRET = 'test-only-otp-secret-that-is-long-enough';
  try {
    await callback();
  } finally {
    if (previous === undefined) delete process.env.OTP_SECRET;
    else process.env.OTP_SECRET = previous;
  }
};

const fakeUser = email => ({
  email,
  emailVerification: undefined,
  passwordReset: undefined,
  saveCalls: 0,
  async save() {
    this.saveCalls += 1;
    return this;
  },
});

test('existing user model defaults to verified while new signup can opt out', () => {
  const existingCompatibleUser = new User({
    name: 'Existing User',
    email: 'existing@example.com',
    password: 'long-enough-password',
  });
  const unverifiedSignup = new User({
    name: 'New User',
    email: 'new@example.com',
    password: 'long-enough-password',
    isEmailVerified: false,
  });

  assert.equal(existingCompatibleUser.isEmailVerified, true);
  assert.equal(unverifiedSignup.isEmailVerified, false);
});

test('signup registration check does not treat a missing user as registered', () => {
  assert.equal(isRegisteredVerifiedUser(null), false);
  assert.equal(isRegisteredVerifiedUser(undefined), false);
  assert.equal(isRegisteredVerifiedUser({ isEmailVerified: false }), false);
  assert.equal(isRegisteredVerifiedUser({ isEmailVerified: true }), true);
  assert.equal(isRegisteredVerifiedUser({}), true);
});

test('Gmail App Password presentation spaces are removed before SMTP auth', () => {
  assert.equal(normalizeSmtpPassword('abcd efgh ijkl mnop'), 'abcdefghijklmnop');
});

test('OTP codes are hashed, single-use, and enforce resend cooldown', async () => {
  await withOtpSecret(async () => {
    const user = fakeUser('traveler@example.com');
    const issued = await issueOtp(user, 'verify-email');

    assert.match(issued.code, /^\d{6}$/);
    assert.notEqual(user.emailVerification.codeHash, issued.code);
    assert.ok(getOtpCooldownSeconds(user, 'verify-email') > 0);
    await assert.rejects(
      issueOtp(user, 'verify-email'),
      error => error.statusCode === 429,
    );

    await consumeOtp(user, 'verify-email', issued.code);
    assert.equal(user.emailVerification, undefined);
  });
});

test('incorrect OTP attempts are counted and valid comparison uses keyed hash', async () => {
  await withOtpSecret(async () => {
    const user = fakeUser('reset@example.com');
    const code = '123456';
    user.passwordReset = {
      codeHash: hashOtp({ email: user.email, purpose: 'reset-password', code }),
      expiresAt: new Date(Date.now() + 60000),
      attempts: 0,
      lastSentAt: new Date(),
    };

    await assert.rejects(
      consumeOtp(user, 'reset-password', '000000'),
      error => error.statusCode === 400,
    );
    assert.equal(user.passwordReset.attempts, 1);
    user.passwordReset.attempts = OTP_MAX_ATTEMPTS;
    await assert.rejects(
      consumeOtp(user, 'reset-password', code),
      error => error.statusCode === 429,
    );
  });
});

test('auth schemas require six-digit OTPs and matching reset passwords', () => {
  assert.equal(verifyEmailSchema.safeParse({
    email: 'person@example.com',
    otp: '123456',
  }).success, true);
  assert.equal(verifyEmailSchema.safeParse({
    email: 'person@example.com',
    otp: '12345',
  }).success, false);
  assert.equal(resetPasswordSchema.safeParse({
    email: 'person@example.com',
    otp: '123456',
    password: 'new-password',
    confirmPassword: 'different-password',
  }).success, false);
});
