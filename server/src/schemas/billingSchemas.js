import { z } from 'zod';

export const createPaymentOrderSchema = z.object({
  packKey: z.enum(['starter', 'explorer', 'pro']),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(8).max(100),
  razorpay_payment_id: z.string().trim().min(8).max(100),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/i),
});
