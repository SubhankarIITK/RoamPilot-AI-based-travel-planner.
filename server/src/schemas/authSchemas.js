import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(8),
  name: z.string().trim().min(1),
});

export const loginSchema = z.object({
  email: z.string().trim().email().transform(value => value.toLowerCase()),
  password: z.string().min(1),
});
