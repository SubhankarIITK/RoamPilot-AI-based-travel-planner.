import api from './axiosInstance.js';
export const createShare = (tripId, data) => api.post(`/share/${tripId}`, data);
export const getPublicShare = (shareId) => api.get(`/share/public/${shareId}`);
export const deactivateShare = (shareId) => api.delete(`/share/${shareId}`);