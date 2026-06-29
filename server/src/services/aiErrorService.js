export const getSafeAIErrorMessage = (
  error,
  fallback = 'The AI provider is temporarily unavailable.',
) => {
  if (error?.statusCode && error?.message) {
    return String(error.message).slice(0, 300);
  }
  if (error?.status === 429 || error?.code === 429) {
    return 'The AI provider reached its temporary rate limit and will be available shortly.';
  }
  if (
    error?.status === 413 ||
    error?.code === 'request_too_large' ||
    /request entity too large|request_too_large/i.test(String(error?.message || ''))
  ) {
    return 'The AI provider rejected an oversized request.';
  }
  if (error?.code === 'AI_OUTPUT_TRUNCATED') {
    return 'The AI response ended before the requested section was complete.';
  }
  return fallback;
};
