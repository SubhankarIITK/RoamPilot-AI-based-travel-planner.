import axios from 'axios';
import { clearAuthToken, getAuthToken } from '../utils/clientStorage.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    const creditBalance = Number(res.headers['x-credit-balance']);
    if (Number.isFinite(creditBalance) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('roampilot:credit-balance', {
        detail: { creditBalance },
      }));
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      clearAuthToken();
      window.location.href = '/login';
    }
    const creditBalance = Number(err.response?.data?.creditBalance);
    if (Number.isFinite(creditBalance) && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('roampilot:credit-balance', {
        detail: { creditBalance },
      }));
    }
    if (err.response?.status === 402 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('roampilot:billing-required', {
        detail: err.response.data,
      }));
    }
    return Promise.reject(err);
  }
);

export default api;
