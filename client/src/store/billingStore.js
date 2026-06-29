import { create } from 'zustand';
import { getBillingSummary } from '../api/billingApi.js';

const useBillingStore = create((set) => ({
  summary: null,
  loading: false,

  loadBilling: async () => {
    set({ loading: true });
    try {
      const response = await getBillingSummary();
      set({ summary: response.data.data, loading: false });
      return response.data.data;
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  },

  setCreditBalance: creditBalance => set(state => ({
    summary: state.summary
      ? {
          ...state.summary,
          subscription: { ...state.summary.subscription, creditBalance },
        }
      : state.summary,
  })),

  clearBilling: () => set({ summary: null, loading: false }),
}));

export default useBillingStore;
