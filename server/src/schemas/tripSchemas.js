import { z } from 'zod';

export const createTripSchema = z.object({
  title: z.string().trim().min(1),
  origin: z.string(),
  destination: z.string().trim().min(1),
  startDate: z.string(),
  endDate: z.string(),
  travelers: z.number().int().min(1),
  budget: z.number().positive(),
  currency: z.string().length(3),
  travelStyle: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const parseTripDescriptionSchema = z.object({
  description: z.string().trim().min(10).max(2000),
});

export const tripCardImagesSchema = z.object({
  tripIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(12),
});
