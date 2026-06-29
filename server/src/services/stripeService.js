import Stripe from 'stripe';
import ApiError from '../utils/ApiError.js';

let stripeClient = null;

export const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new ApiError(503, 'Billing is not configured. Add Stripe credentials to the server environment.');
  }
  if (!stripeClient) stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
};

export const isStripeConfigured = () =>
  Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
