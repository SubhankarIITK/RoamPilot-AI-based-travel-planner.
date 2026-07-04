import logger from './logger.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const DEFAULT_MIN_INTERVAL_MS = 1200;
let geminiQueue = Promise.resolve();
let lastGeminiCallAt = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const boundedNumber = (value, fallback, minimum, maximum) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.max(minimum, Math.min(maximum, parsed))
    : fallback;
};

const mergeMessages = messages => {
  const contents = [];
  for (const message of messages || []) {
    if (message?.role === 'system') continue;
    const role = message?.role === 'assistant' ? 'model' : 'user';
    const text = String(message?.content || '').trim();
    if (!text) continue;
    const previous = contents.at(-1);
    if (previous?.role === role) {
      previous.parts[0].text += `\n\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }
  return contents.length
    ? contents
    : [{ role: 'user', parts: [{ text: 'Respond to the system instruction.' }] }];
};

export const buildGeminiRequest = (messages, options = {}) => {
  const systemText = (messages || [])
    .filter(message => message?.role === 'system')
    .map(message => String(message.content || '').trim())
    .filter(Boolean)
    .join('\n\n');
  const thinkingBudget = boundedNumber(
    options.thinkingBudget ?? process.env.GEMINI_THINKING_BUDGET,
    0,
    0,
    24576,
  );
  return {
    ...(systemText ? {
      systemInstruction: { parts: [{ text: systemText }] },
    } : {}),
    contents: mergeMessages(messages),
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.max_tokens ?? 1200,
      thinkingConfig: { thinkingBudget },
      ...(options.response_format?.type === 'json_object'
        ? { responseMimeType: 'application/json' }
        : {}),
    },
  };
};

const retryDelay = (error, attempt) => {
  const retryAfter = Number(error?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(65000, retryAfter * 1000 + 300);
  }
  return Math.min(30000, 1000 * 2 ** attempt);
};

const notifyWait = async (callback, payload) => {
  if (typeof callback !== 'function') return;
  try {
    await callback(payload);
  } catch {
    // Progress reporting must never block the provider request.
  }
};

const enqueueGeminiCall = task => {
  const run = geminiQueue.then(async () => {
    const interval = boundedNumber(
      process.env.GEMINI_MIN_INTERVAL_MS,
      DEFAULT_MIN_INTERVAL_MS,
      0,
      10000,
    );
    const delay = Math.max(0, interval - (Date.now() - lastGeminiCallAt));
    if (delay) await wait(delay);
    lastGeminiCallAt = Date.now();
    return task();
  });
  geminiQueue = run.catch(() => {});
  return run;
};

const geminiError = async response => {
  const body = await response.json().catch(() => ({}));
  const error = new Error(
    body?.error?.message || `Gemini request failed with status ${response.status}`,
  );
  error.status = response.status;
  error.code = body?.error?.status || response.status;
  error.headers = response.headers;
  return error;
};

export const callGemini = async (messages, options = {}) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const model = String(
    options.geminiModel ||
    (String(options.model || '').startsWith('gemini-') ? options.model : '') ||
    process.env.GEMINI_MODEL ||
    DEFAULT_MODEL,
  ).trim();
  const payload = buildGeminiRequest(messages, options);
  const retries = Number.isInteger(options.retries) ? options.retries : 1;

  return enqueueGeminiCall(async () => {
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        const timeoutMs = boundedNumber(
          process.env.GEMINI_TIMEOUT_MS,
          120000,
          5000,
          240000,
        );
        const response = await fetch(
          `${GEMINI_API_URL}/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': process.env.GEMINI_API_KEY,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(timeoutMs),
          },
        );
        if (!response.ok) throw await geminiError(response);

        const data = await response.json();
        const candidate = data?.candidates?.[0];
        if (candidate?.finishReason === 'MAX_TOKENS') {
          const error = new Error('Gemini response was truncated before completion');
          error.code = 'AI_OUTPUT_TRUNCATED';
          throw error;
        }
        const content = (candidate?.content?.parts || [])
          .filter(part => !part?.thought && typeof part?.text === 'string')
          .map(part => part.text)
          .join('')
          .trim();
        if (!content) {
          const reason = data?.promptFeedback?.blockReason || candidate?.finishReason;
          const error = new Error(
            reason ? `Gemini returned no content (${reason})` : 'Gemini returned an empty response',
          );
          error.code = 'AI_EMPTY_RESPONSE';
          throw error;
        }
        return content;
      } catch (error) {
        lastError = error;
        const retryable =
          error?.status === 429 ||
          Number(error?.status) >= 500 ||
          error?.name === 'TimeoutError' ||
          error?.name === 'TypeError';
        if (!retryable || attempt === retries) break;
        const delay = retryDelay(error, attempt);
        logger.info(
          { stage: 'gemini-retry', model, durationMs: delay },
          'Gemini request is waiting before retry',
        );
        await notifyWait(options.onWait, {
          waiting: true,
          reason: error?.status === 429 ? 'rate-limit' : 'provider-retry',
          durationMs: delay,
          model,
        });
        await wait(delay);
        await notifyWait(options.onWait, {
          waiting: false,
          reason: error?.status === 429 ? 'rate-limit' : 'provider-retry',
          durationMs: 0,
          model,
        });
      }
    }
    throw lastError;
  });
};

export const isGeminiAvailable = () => Boolean(process.env.GEMINI_API_KEY);
