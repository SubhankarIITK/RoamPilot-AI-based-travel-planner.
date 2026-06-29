import api from './axiosInstance.js';
export const getTripChecklist = (tripId) => api.get(`/checklists/trip/${tripId}`);
export const addChecklistItem = (data) => api.post('/checklists', data);
export const toggleChecklistItem = (id) => api.put(`/checklists/${id}/toggle`);
export const deleteChecklistItem = (id) => api.delete(`/checklists/${id}`);