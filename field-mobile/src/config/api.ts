import axios from 'axios';
import { getCurrentJWT } from './supabase';
import { API_BASE_URL } from './env';

// Create axios instance with environment-based URL
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add JWT token
api.interceptors.request.use(
  async (config) => {
    const token = await getCurrentJWT();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.error('API Authentication failed');
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  auth: {
    me: () => '/auth/me',
  },
  incidents: {
    list: () => '/incidents',
    create: () => '/incidents',
    get: (id: string) => `/incidents/${id}`,
    update: (id: string) => `/incidents/${id}`,
    active: () => '/incidents/active',
    detail: (id: string) => `/incidents/${id}/detail`,
  },
  patients: {
    create: () => '/patients',
    get: (id: string) => `/patients/${id}`,
    byIncident: (incidentId: string) => `/patients/incident/${incidentId}`,
  },
  vitals: {
    create: () => '/vitals',
    byPatient: (patientId: string) => `/vitals/patient/${patientId}`,
  },
  interventions: {
    create: () => '/interventions',
    byPatient: (patientId: string) => `/interventions/patient/${patientId}`,
  },
};

// Health check - useful for debugging connection issues
export async function checkApiHealth(): Promise<{ ok: boolean; url: string; error?: string }> {
  try {
    await api.get('/health', { timeout: 5000 });
    return { ok: true, url: API_BASE_URL };
  } catch (error: any) {
    return { 
      ok: false, 
      url: API_BASE_URL,
      error: error.message 
    };
  }
}
