import axios from 'axios';

const apiBaseUrl = import.meta.env.PROD
  ? '/api'
  : import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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
