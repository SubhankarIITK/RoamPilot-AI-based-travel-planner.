import { AsyncLocalStorage } from 'node:async_hooks';

const providerContext = new AsyncLocalStorage();
const ALLOWED_PROVIDERS = new Set(['auto', 'groq', 'gemini']);

export const normalizeAIProvider = value => {
  const provider = String(value || '').trim().toLowerCase();
  return ALLOWED_PROVIDERS.has(provider) ? provider : null;
};

export const runWithAIProvider = (provider, callback) =>
  providerContext.run(normalizeAIProvider(provider), callback);

export const getRequestedAIProvider = () => providerContext.getStore() || null;
