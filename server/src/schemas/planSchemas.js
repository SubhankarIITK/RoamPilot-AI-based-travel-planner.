import { z } from 'zod';

export const planTripSchema = z.object({
  tripId: z.string().min(1),
  instructions: z.string().optional(),
  useWebSearch: z.boolean().default(false),
  planningAnswers: z.record(z.string(), z.unknown()).optional(),
  workflowId: z.string().optional(),
});

export const lazyDaySchema = z.object({
  tripId: z.string().min(1),
  dayNumber: z.number().int().min(1),
  instruction: z.string().trim().max(700).optional().default(''),
});

export const finalizeLazyPlanSchema = z.object({
  tripId: z.string().min(1),
});

export const chatSchema = z.object({
  tripId: z.string().min(1),
  message: z.string().trim().min(1).max(4000),
});

export const regenerateDaySchema = z.object({
  tripId: z.string().min(1),
  dayNumber: z.number().int().min(1),
  instructions: z.string().optional(),
  // Keep the existing singular request key during the cookie-auth migration.
  instruction: z.string().optional(),
}).transform(data => ({
  ...data,
  instruction: data.instruction ?? data.instructions ?? '',
}));

export const transformTripSchema = z.object({
  tripId: z.string().min(1),
  transformation: z.string().trim().min(1).max(500),
});
