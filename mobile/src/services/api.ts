import axios, { AxiosError } from 'axios';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from './storage';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
});

let onSessionExpired: (() => void) | null = null;

export function setOnSessionExpired(handler: () => void) {
  onSessionExpired = handler;
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new Error('Nessun refresh token disponibile');
  }

  const response = await axios.post(`${process.env.EXPO_PUBLIC_API_URL}/auth/refresh`, {
    refreshToken,
  });

  const { accessToken, refreshToken: newRefreshToken } = response.data.data;
  await saveTokens(accessToken, newRefreshToken);
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ error?: { code?: string } }>) => {
    const originalRequest = error.config;
    const errorCode = error.response?.data?.error?.code;

    if (error.response?.status === 401 && errorCode === 'AUTH_TOKEN_EXPIRED' && originalRequest) {
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        const newAccessToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api.request(originalRequest);
      } catch {
        await clearTokens();
        onSessionExpired?.();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);
