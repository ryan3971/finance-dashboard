import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api/v1',
  withCredentials: true,
});

// Attach access token to every outgoing request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, attempt a token refresh then retry the original request once
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Use bare axios here — not the api instance — to avoid the request
        // interceptor attaching a stale/invalid token to the refresh call.
        // withCredentials is required so the httpOnly refresh_token cookie is sent.
        const { data } = await axios.post(
          'http://localhost:3001/api/v1/auth/refresh',
          {},
          { withCredentials: true }
        );

        const newToken = data.accessToken;
        localStorage.setItem('accessToken', newToken);

        // Retry the original request with the new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — clear local state and redirect to login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;