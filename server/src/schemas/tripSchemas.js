import { z } from 'zod';

export const createTripSchema = z.object({
  title: z.string().trim().min(1),
  origin: z.string(),
  destination: z.string().trim().min(1),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().min(1),
  budget: z.number().nonnegative().optional().default(0),
  budgetMode: z.enum([
    'ai-managed',
    'budget-friendly',
    'balanced',
    'premium',
    'luxury',
    'hard-budget',
  ]).optional().default('ai-managed'),
  currency: z.string().length(3),
  travelStyle: z.string().optional(),
  notes: z.string().optional(),
}).passthrough().superRefine((trip, context) => {
  if (trip.budgetMode === 'hard-budget' && !(trip.budget > 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['budget'],
      message: 'Enter a positive amount for a user-defined hard budget',
    });
  }
});

export const parseTripDescriptionSchema = z.object({
  description: z.string().trim().min(10).max(2000),
});

export const tripCardImagesSchema = z.object({
  tripIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(12),
});
