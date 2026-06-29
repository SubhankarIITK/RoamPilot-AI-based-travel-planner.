import api from './axiosInstance.js';
export const createTrip = (data) => api.post('/trips', data);
export const parseTripDescription = (description) => api.post('/trips/parse-description', { description });
export const getTrips = () => api.get('/trips');
export const getTripById = (id) => api.get(`/trips/${id}`);
export const updateTrip = (id, data) => api.put(`/trips/${id}`, data);
export const deleteTrip = (id) => api.delete(`/trips/${id}`);
