import Groq from 'groq-sdk';
import logger from './logger.js';

let groqClient = null;
let groqQueue = Promise.resolve();
let lastGroqCallAt = 0;
const tokenWindows = new Map();
const observedModelTpmLimits = new Map();

const TOKEN_WINDOW_MS = 60000;
const DEFAULT_TPM_SAFETY_RATIO = 0.8;
const DEFAULT_MIN_REQUEST_INTERVAL_MS = 2100;
const KNOWN_MODEL_TPM_LIMITS = {
  'meta-llama/llama-4-scout-17b-16e-instruct': 30000,
  'openai/gpt-oss-120b': 8000,
  'openai/gpt-oss-20b': 8000,
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const getHeader = (headers, name) => {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  return headers[name] || headers[name.toLowerCase()] || null;
};

export const parseGroqDurationMs = value => {
  if (value === null || value === undefined) return null;
  const source = String(value).trim().toLowerCase();
  if (!source) return null;

  let total = 0;
  let matched = false;
  const pattern = /([\d.]+)\s*(ms|h|m|s)/g;
  for (const match of source.matchAll(pattern)) {
    const amount = Number(match[1]);
    if (!Number.isFinite(amount)) continue;
    matched = true;
    if (match[2] === 'ms') total += amount;
    if (match[2] === 's') total += amount * 1000;
    if (match[2] === 'm') total += amount * 60000;
    if (match[2] === 'h') total += amount * 3600000;
  }
  return matched ? total : null;
};

export const getRetryAfterMs = (error, attempt = 0) => {
  const retryAfter = Number(getHeader(error.headers, 'retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(65000, retryAfter * 1000 + 300);
  }

  const tokenReset = parseGroqDurationMs(
    getHeader(error.headers, 'x-ratelimit-reset-tokens'),
  );
  if (Number.isFinite(tokenReset) && tokenReset > 0) {
    return Math.min(65000, tokenReset + 300);
  }

  const messageDuration = String(error.message || '')
    .match(/try again in\s+([\d.\s]+(?:ms|s|m|h)(?:\s*[\d.]+\s*(?:ms|s|m|h))*)/i)?.[1];
  const messageDelay = parseGroqDurationMs(messageDuration);
  if (Number.isFinite(messageDelay) && messageDelay > 0) {
    return Math.min(65000, messageDelay + 300);
  }

  return Math.min(30000, 1000 * 2 ** attempt);
};

const getModelTpmLimit = model => {
  const globalOverride = Number(process.env.GROQ_TPM_LIMIT);
  if (Number.isFinite(globalOverride) && globalOverride > 0) return globalOverride;
  const observedLimit = observedModelTpmLimits.get(model);
  if (Number.isFinite(observedLimit) && observedLimit > 0) return observedLimit;
  return KNOWN_MODEL_TPM_LIMITS[model] || 6000;
};

const rememberModelTpmLimit = (model, headers) => {
  const limit = Number(getHeader(headers, 'x-ratelimit-limit-tokens'));
  if (Number.isFinite(limit) && limit > 0) {
    observedModelTpmLimits.set(model, limit);
  }
};

const estimateMessageTokens = messages =>
  Math.ceil(
    (messages || []).reduce(
      (total, message) => total + String(message?.content || '').length + 16,
      0,
    ) / 4,
  );

export const estimateGroqRequestTokens = payload =>
  estimateMessageTokens(payload.messages) +
  Math.max(0, Number(payload.max_tokens) || 0);

const reserveTokenBudget = async payload => {
  const model = payload.model;
  const configuredRatio = Number(process.env.GROQ_TPM_SAFETY_RATIO);
  const safetyRatio = Number.isFinite(configuredRatio) && configuredRatio > 0 && configuredRatio <= 1
    ? configuredRatio
    : DEFAULT_TPM_SAFETY_RATIO;
  const budget = Math.floor(getModelTpmLimit(model) * safetyRatio);
  const requested = Math.min(estimateGroqRequestTokens(payload), budget);

  while (true) {
    const now = Date.now();
    const active = (tokenWindows.get(model) || [])
      .filter(entry => now - entry.startedAt < TOKEN_WINDOW_MS);
    tokenWindows.set(model, active);
    const used = active.reduce((total, entry) => total + entry.tokens, 0);

    if (active.length === 0 || used + requested <= budget) {
      const reservation = { startedAt: now, tokens: requested };
      active.push(reservation);
      return reservation;
    }

    const delay = Math.max(100, TOKEN_WINDOW_MS - (now - active[0].startedAt) + 100);
    logger.info(
      { stage: 'groq-token-pacing', model, durationMs: delay },
      'Groq token budget is pacing the next request',
    );
    await wait(delay);
  }
};

const releaseReservation = (model, reservation) => {
  const active = tokenWindows.get(model) || [];
  tokenWindows.set(model, active.filter(entry => entry !== reservation));
};

const updateReservation = (reservation, response) => {
  const actualTokens = Number(response?.usage?.total_tokens);
  if (Number.isFinite(actualTokens) && actualTokens > 0) {
    reservation.tokens = actualTokens;
  }
};

const enqueueGroqCall = async (_model, task) => {
  const run = groqQueue.then(async () => {
    const configuredInterval = Number(process.env.GROQ_MIN_INTERVAL_MS);
    const minInterval = Number.isFinite(configuredInterval) && configuredInterval >= 0
      ? Math.min(10000, configuredInterval)
      : DEFAULT_MIN_REQUEST_INTERVAL_MS;
    const delay = Math.max(0, minInterval - (Date.now() - lastGroqCallAt));
    if (delay) await wait(delay);
    lastGroqCallAt = Date.now();
    return task();
  });
  groqQueue = run.catch(() => {});
  return run;
};

const createChatCompletion = async (payload, options = {}) =>
  enqueueGroqCall(payload.model, async () => {
    const client = getClient();
    if (!client) {
      throw new Error('GROQ_API_KEY not configured');
    }

    const retries = Number.isInteger(options.retries) ? options.retries : 1;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const reservation = await reserveTokenBudget(payload);
      try {
        const { data, response } = await client.chat.completions
          .create(payload)
          .withResponse();
        rememberModelTpmLimit(payload.model, response.headers);
        updateReservation(reservation, data);
        return data;
      } catch (error) {
        releaseReservation(payload.model, reservation);
        rememberModelTpmLimit(payload.model, error?.headers);
        lastError = error;
        const isRateLimited = error?.status === 429 || error?.code === 429;
        const isDailyLimit = /per day|tokens per day|requests per day|\bTPD\b|\bRPD\b/i
          .test(String(error?.message || ''));
        if (!isRateLimited || isDailyLimit || attempt === retries) break;
        await wait(getRetryAfterMs(error, attempt));
      }
    }
    throw lastError;
  });

const getClient = () => {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
};

export const callGroq = async (messages, options = {}) => {
  const response = await createChatCompletion({
    model: options.model ||
      process.env.GROQ_MODEL ||
      'meta-llama/llama-4-scout-17b-16e-instruct',
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 1200,
    ...(options.response_format ? { response_format: options.response_format } : {}),
    ...(options.reasoning_effort ? { reasoning_effort: options.reasoning_effort } : {}),
  }, { retries: options.retries });
  const choice = response.choices?.[0];
  if (choice?.finish_reason === 'length') {
    const error = new Error('Groq response was truncated before completion');
    error.code = 'AI_OUTPUT_TRUNCATED';
    throw error;
  }
  const content = choice?.message?.content;
  if (!content) throw new Error('Groq returned an empty response');
  return content;
};

export const isGroqAvailable = () => !!process.env.GROQ_API_KEY;
