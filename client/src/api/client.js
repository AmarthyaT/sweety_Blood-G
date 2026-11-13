const TOKEN_KEY = 'sweety.token';
const API_BASE = import.meta.env.VITE_API_URL || '/api';

let memoryToken = null;

export function getToken() {
  if (memoryToken) return memoryToken;
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  memoryToken = token || null;
  if (typeof localStorage === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Could not reach the server. Please check your connection.', 0);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      data.message || 'Something went wrong. Please try again.',
      response.status,
      data.code,
      data.details,
    );
  }

  return data;
}

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  listReadings: (params = {}) => request(`/readings${queryString(params)}`),
  createReading: (payload) => request('/readings', { method: 'POST', body: payload }),
  updateReading: (id, payload) => request(`/readings/${id}`, { method: 'PUT', body: payload }),
  deleteReading: (id) => request(`/readings/${id}`, { method: 'DELETE' }),

  getReport: (params = {}) => request(`/reports${queryString(params)}`),

  listPatients: () => request('/doctor/patients'),
  assignPatient: (email) => request('/doctor/patients', { method: 'POST', body: { email } }),
  getPatientReport: (patientId, params = {}) =>
    request(`/doctor/patients/${patientId}/reports${queryString(params)}`),
};

export default api;
