import api from './axiosInstance.js';

export const getBillingPlans = () => api.get('/billing/plans');
export const getBillingSummary = () => api.get('/billing/summary');
export const createPaymentOrder = packKey => api.post('/billing/order', { packKey });
export const verifyPayment = payment => api.post('/billing/verify', payment);
