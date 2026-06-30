import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1),
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(1),
});

export const emailOtpRequestSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
});

export const verifyEmailSchema = emailOtpRequestSchema.extend({
  otp: z.string().trim().regex(/^\d{6}$/, 'Enter the six-digit verification code'),
});

export const resetPasswordSchema = verifyEmailSchema.extend({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine(data => data.password === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});
