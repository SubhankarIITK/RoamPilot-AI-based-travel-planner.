const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_MIN_INTERVAL_MS = 500;

let searchQueue = Promise.resolve();
let lastRequestAt = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const boundedNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, parsed))
    : fallback;
};

const safeUrl = value => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

export const normalizeTavilyQuery = query =>
  String(query || '').trim().replace(/\s+/g, ' ').slice(0, 390);

export const formatTavilyResponse = data => {
  const answer = String(data?.answer || '').trim().slice(0, 2400);
  const sources = (Array.isArray(data?.results) ? data.results : [])
    .map(result => ({
      title: String(result?.title || 'Source').trim().slice(0, 180),
      url: safeUrl(result?.url),
      content: String(result?.content || '').trim().slice(0, 700),
      score: Number(result?.score) || 0,
    }))
    .filter(result => result.url && result.content)
    .slice(0, 8);

  const sections = [];
  if (answer) sections.push(`Search summary:\n${answer}`);
  if (sources.length) {
    sections.push(`Sources:\n${sources.map((source, index) =>
      `${index + 1}. ${source.title}\nURL: ${source.url}\nRelevant excerpt: ${source.content}`,
    ).join('\n\n')}`);
  }

  return {
    content: sections.join('\n\n').slice(0, 7500),
    sources,
    executedTools: [{ type: 'tavily_search' }],
    requestId: String(data?.request_id || ''),
  };
};

const getRetryDelayMs = (response, attempt) => {
  const retryAfter = Number(response?.headers?.get?.('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(10000, retryAfter * 1000);
  }
  return Math.min(5000, 750 * 2 ** attempt + Math.floor(Math.random() * 250));
};

const executeSearch = async (query, options) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new Error('TAVILY_API_KEY not configured');

  const timeoutMs = boundedNumber(
    process.env.TAVILY_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
    3000,
    30000,
  );
  const maxResults = boundedNumber(options.maxResults, 5, 1, 8);
  const retries = boundedNumber(options.retries, 2, 0, 3);
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(process.env.TAVILY_PROJECT_ID
            ? { 'X-Project-ID': process.env.TAVILY_PROJECT_ID }
            : {}),
        },
        body: JSON.stringify({
          query: normalizeTavilyQuery(query),
          topic: options.topic || 'general',
          search_depth: options.searchDepth || 'basic',
          include_answer: options.includeAnswer ?? 'basic',
          include_raw_content: false,
          max_results: maxResults,
        }),
        signal: controller.signal,
      });

      if (response.ok) {
        const result = formatTavilyResponse(await response.json());
        if (!result.content) throw new Error('Tavily returned no usable search results');
        return result;
      }

      const details = await response.text().catch(() => '');
      const error = new Error(
        `Tavily search failed (${response.status})${details ? `: ${details.slice(0, 240)}` : ''}`,
      );
      error.status = response.status;
      lastError = error;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === retries) throw error;
      await wait(getRetryDelayMs(response, attempt));
    } catch (error) {
      lastError = error;
      const retryable =
        error?.name === 'AbortError' ||
        error instanceof TypeError ||
        error?.status >= 500 ||
        /fetch failed|network|econnreset|enotfound|socket/i.test(String(error?.message || ''));
      if (!retryable || attempt === retries) throw error;
      await wait(750 * 2 ** attempt + Math.floor(Math.random() * 250));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
};

export const searchTavily = (query, options = {}) => {
  const run = searchQueue.then(async () => {
    const minIntervalMs = boundedNumber(
      process.env.TAVILY_MIN_INTERVAL_MS,
      DEFAULT_MIN_INTERVAL_MS,
      0,
      10000,
    );
    const delay = Math.max(0, minIntervalMs - (Date.now() - lastRequestAt));
    if (delay) await wait(delay);
    lastRequestAt = Date.now();
    return executeSearch(query, options);
  });

  searchQueue = run.catch(() => {});
  return run;
};

export const isTavilyAvailable = () => !!process.env.TAVILY_API_KEY;

export const getSafeTavilyErrorMessage = error => {
  const message = String(error?.message || '');
  if (/TAVILY_API_KEY not configured/i.test(message)) {
    return 'Tavily is not configured in the running server. Restart after adding TAVILY_API_KEY.';
  }
  if (error?.status === 401 || error?.status === 403) {
    return 'Tavily rejected the configured API key or project permissions.';
  }
  if (error?.status === 429) {
    return 'Tavily reached its search quota or temporary rate limit.';
  }
  if (error?.name === 'AbortError') {
    return 'Tavily search timed out after automatic retries.';
  }
  if (error?.status >= 500 || /fetch failed|network|econnreset|enotfound|socket/i.test(message)) {
    return 'Tavily could not be reached after automatic retries.';
  }
  if (/no usable search results/i.test(message)) {
    return 'Tavily returned no usable sources for this search.';
  }
  return 'Tavily research failed; the itinerary continued without live sources.';
};
