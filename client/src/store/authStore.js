import { create } from 'zustand';
import useBillingStore from './billingStore.js';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/clientStorage.js';

const useAuthStore = create((set) => ({
  user: null,
  token: getAuthToken(),
  isAuthenticated: Boolean(getAuthToken()),

  setAuth: (user, token) => {
    setAuthToken(token);
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    clearAuthToken();
    useBillingStore.getState().clearBilling();
    set({ user: null, token: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),
}));

export default useAuthStore;
