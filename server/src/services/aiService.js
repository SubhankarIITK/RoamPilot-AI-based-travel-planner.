import { callGemini, isGeminiAvailable } from './geminiService.js';
import { callGroq, isGroqAvailable } from './groqService.js';
import { getRequestedAIProvider, normalizeAIProvider } from './aiProviderContext.js';
import logger from './logger.js';

const configuredProvider = override =>
  normalizeAIProvider(override) ||
  getRequestedAIProvider() ||
  normalizeAIProvider(process.env.AI_PROVIDER) ||
  'auto';

export const getActiveAIProvider = override => {
  const provider = configuredProvider(override);
  if (provider === 'groq') return isGroqAvailable() ? 'groq' : null;
  if (provider === 'gemini') return isGeminiAvailable() ? 'gemini' : null;
  if (isGroqAvailable()) return 'groq';
  if (isGeminiAvailable()) return 'gemini';
  return null;
};

export const isAIAvailable = () => Boolean(getActiveAIProvider());

export const getAIProviderConfiguration = () => ({
  selectedProvider: configuredProvider(),
  activeProvider: getActiveAIProvider(),
  availableProviders: {
    groq: isGroqAvailable(),
    gemini: isGeminiAvailable(),
  },
});

const shouldFallback = error =>
  error?.status === 429 ||
  Number(error?.status) >= 500 ||
  error?.name === 'TimeoutError' ||
  error?.name === 'TypeError';

const invoke = (provider, messages, options) =>
  provider === 'gemini'
    ? callGemini(messages, options)
    : callGroq(messages, options);

export const callAI = async (messages, options = {}) => {
  const providerPreference = configuredProvider(options.provider);
  const primary = getActiveAIProvider(providerPreference);
  if (!primary) {
    throw new Error(
      'AI provider is not configured. Add GROQ_API_KEY or GEMINI_API_KEY.',
    );
  }

  try {
    return await invoke(primary, messages, options);
  } catch (error) {
    const autoMode = providerPreference === 'auto';
    const fallback = primary === 'groq' && isGeminiAvailable()
      ? 'gemini'
      : primary === 'gemini' && isGroqAvailable()
        ? 'groq'
        : null;
    if (!autoMode || !fallback || !shouldFallback(error)) throw error;

    logger.warn(
      { stage: 'ai-provider-fallback', primary, fallback, error: error.message },
      'Primary AI provider failed; using configured fallback',
    );
    return invoke(fallback, messages, { ...options, retries: 0 });
  }
};
