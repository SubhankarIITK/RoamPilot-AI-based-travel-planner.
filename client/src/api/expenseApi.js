import api from './axiosInstance.js';
export const addExpense = (data) => api.post('/expenses', data);
export const getTripExpenses = (tripId) => api.get(`/expenses/trip/${tripId}`);
export const getExpenseSummary = (tripId) => api.get(`/expenses/trip/${tripId}/summary`);
export const updateExpense = (id, data) => api.put(`/expenses/${id}`, data);
export const deleteExpense = (id) => api.delete(`/expenses/${id}`);