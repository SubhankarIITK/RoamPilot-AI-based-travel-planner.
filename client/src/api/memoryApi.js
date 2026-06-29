import api from './axiosInstance.js';

export const getTripMemory = (tripId) => api.get(`/memories/trip/${tripId}`);
export const getMyMemories = () => api.get('/memories/me');
export const saveMemory = (data) => api.post('/memories', data);
