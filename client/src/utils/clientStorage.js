export const THEME_KEY = 'roampilot:v1:theme';
export const AI_PROVIDER_KEY = 'roampilot:v1:ai-provider';

const LEGACY_AUTH_TOKEN_KEY = 'rp_token';
const PREVIOUS_AUTH_TOKEN_KEY = 'roampilot:v1:auth-token';
const LEGACY_THEME_KEY = 'rp_theme';

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export const clearLegacyAuthState = () => {
  const clientStorage = storage();
  if (!clientStorage) return;
  // HttpOnly cookies replaced browser-readable JWT persistence.
  clientStorage.removeItem(PREVIOUS_AUTH_TOKEN_KEY);
  clientStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
};

export const getThemePreference = () => {
  const clientStorage = storage();
  if (!clientStorage) return 'system';
  const preference = clientStorage.getItem(THEME_KEY);
  clientStorage.removeItem(LEGACY_THEME_KEY);
  return preference || 'system';
};

export const setThemePreference = preference => {
  const clientStorage = storage();
  if (!clientStorage) return;
  clientStorage.removeItem(LEGACY_THEME_KEY);
  clientStorage.setItem(THEME_KEY, preference);
};

export const getAIProviderPreference = () => {
  const preference = storage()?.getItem(AI_PROVIDER_KEY);
  return preference === 'groq' ? preference : 'groq';
};

export const setAIProviderPreference = preference => {
  if (preference !== 'groq') return;
  storage()?.setItem(AI_PROVIDER_KEY, preference);
};
