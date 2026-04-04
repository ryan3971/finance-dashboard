import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { config } from '@/lib/config';
import { STORAGE_KEYS } from '@/lib/storageKeys';

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

const api = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
});

// Attach access token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, attempt a token refresh then retry the original request once
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Use bare axios here — not the api instance — to avoid the request
        // interceptor attaching a stale/invalid token to the refresh call.
        // withCredentials is required so the httpOnly refresh_token cookie is sent.
        const { data } = await axios.post<{ accessToken: string }>(
          `${config.apiBaseUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newToken = data.accessToken;
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newToken);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return await api(originalRequest);
      } catch {
        // Refresh failed — clear local state and redirect to login
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;