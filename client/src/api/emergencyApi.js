import api from './axiosInstance.js';
export const getEmergencyInfo = (tripId) => api.get(`/emergency/trip/${tripId}`);
export const saveEmergencyInfo = (data) => api.post('/emergency', data);