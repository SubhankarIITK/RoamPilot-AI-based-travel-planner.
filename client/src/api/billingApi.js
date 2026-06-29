import api from './axiosInstance.js';

export const getBillingPlans = () => api.get('/billing/plans');
export const getBillingSummary = () => api.get('/billing/summary');
export const createCheckout = planKey => api.post('/billing/checkout', { planKey });
export const createBillingPortal = () => api.post('/billing/portal');
