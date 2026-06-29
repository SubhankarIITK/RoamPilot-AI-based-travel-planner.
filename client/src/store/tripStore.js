import { create } from 'zustand';

const useTripStore = create((set) => ({
  trips: [],
  currentTrip: null,
  loading: false,
  error: null,

  setTrips: (trips) => set({ trips }),
  setCurrentTrip: (trip) => set({ currentTrip: trip }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

  updateCurrentTripPlan: (plan) =>
    set((state) => ({
      currentTrip: state.currentTrip ? { ...state.currentTrip, aiPlan: plan } : null,
    })),
}));

export default useTripStore;