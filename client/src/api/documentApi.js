import api from './axiosInstance.js';
export const uploadDocument = (formData) => api.post('/documents/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getTripDocuments = (tripId) => api.get(`/documents/trip/${tripId}`);
export const deleteDocument = (id) => api.delete(`/documents/${id}`);