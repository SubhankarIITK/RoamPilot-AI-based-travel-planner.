import { create } from 'zustand';
import useBillingStore from './billingStore.js';
import { logoutSession } from '../api/authApi.js';
import { clearLegacyAuthState } from '../utils/clientStorage.js';

clearLegacyAuthState();

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: true,

  setAuth: user => set({ user, isAuthenticated: true }),

  logout: async ({ remote = true } = {}) => {
    try {
      if (remote) await logoutSession();
    } catch {
      // Local logout must still complete if the server is temporarily unreachable.
    } finally {
      useBillingStore.getState().clearBilling();
      set({ user: null, isAuthenticated: false });
    }
  },

  setUser: (user) => set({ user }),
}));

export default useAuthStore;
