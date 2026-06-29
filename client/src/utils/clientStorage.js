export const AUTH_TOKEN_KEY = 'roampilot:v1:auth-token';
export const THEME_KEY = 'roampilot:v1:theme';

const LEGACY_AUTH_TOKEN_KEY = 'rp_token';
const LEGACY_THEME_KEY = 'rp_theme';

const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export const getAuthToken = () => {
  const clientStorage = storage();
  if (!clientStorage) return null;
  // Generic localhost keys may belong to another project. Never adopt them.
  clientStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  return clientStorage.getItem(AUTH_TOKEN_KEY);
};

export const setAuthToken = token => {
  const clientStorage = storage();
  if (!clientStorage) return;
  clientStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
  clientStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearAuthToken = () => {
  const clientStorage = storage();
  if (!clientStorage) return;
  clientStorage.removeItem(AUTH_TOKEN_KEY);
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
