import api from './axiosInstance.js';
export const getTripVersions = (tripId) => api.get(`/versions/trip/${tripId}`);
export const getVersion = (id) => api.get(`/versions/${id}`);
export const restoreVersion = (id) => api.post(`/versions/${id}/restore`);
export const deleteVersion = (id) => api.delete(`/versions/${id}`);
