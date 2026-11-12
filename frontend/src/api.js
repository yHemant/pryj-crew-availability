import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
});

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on 401/403
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && (err.response.status === 401 || err.response.status === 403)) {
      // Only clear token if it's not the login endpoint itself
      if (!err.config.url.includes('/login')) {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    }
    return Promise.reject(err);
  }
);

export const login = (username, password) =>
  api.post('/login', { username, password });

export const uploadFile = (formData) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getSummary = (date) =>
  api.get('/summary', { params: date ? { date } : {} });

export const getCrewDetails = (station, type, bucket, date) =>
  api.get('/crew/details', { params: { station, type, bucket, ...(date ? { date } : {}) } });

export default api;

