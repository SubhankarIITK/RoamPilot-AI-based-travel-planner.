import api from './axiosInstance.js';
export const planTrip = (tripId, options = {}) => api.post('/ai/plan-trip', { tripId, ...options });
export const getPlanningProgress = workflowId => api.get(`/ai/plan-progress/${workflowId}`);
export const getPlanningQuestions = (tripId) => api.post('/ai/planning-questions', { tripId });
export const chatTrip = (tripId, message) => api.post('/ai/chat-trip', { tripId, message });
export const getChatHistory = (tripId) => api.get(`/ai/chat-history/${tripId}`);
export const researchTrip = (tripId, focus) => api.post('/ai/research-trip', { tripId, focus });
export const regenerateDay = (tripId, dayNumber, instruction) => api.post('/ai/regenerate-day', { tripId, dayNumber, instruction });
export const optimizeBudget = (tripId) => api.post('/ai/optimize-budget', { tripId });
export const createPackingList = (tripId) => api.post('/ai/create-packing-list', { tripId });
export const safetyGuide = (tripId) => api.post('/ai/safety-guide', { tripId });
export const transformTrip = (tripId, transformation) => api.post('/ai/transform-trip', { tripId, transformation });
export const scoreTrip = (tripId) => api.post('/ai/score-trip', { tripId });
export const transcribeSpeech = ({ audio, fileName, language }) => {
  const formData = new FormData();
  formData.append('audio', audio, fileName);
  if (language) formData.append('language', language);
  return api.post('/ai/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
