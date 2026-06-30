import api from './axiosInstance.js';
export const signup = (data) => api.post('/auth/signup', data);
export const login = (data) => api.post('/auth/login', data);
export const logoutSession = () => api.post('/auth/logout');
export const getMe = () => api.get('/auth/me');
export const updateMe = (data) => api.put('/auth/me', data);
