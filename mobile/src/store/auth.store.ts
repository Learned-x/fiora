import { create } from 'zustand';
import { AxiosError } from 'axios';
import { api, setOnSessionExpired } from '../services/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../services/storage';
import { GoogleSignInCancelledError, signInWithGoogle } from '../services/oauth';

interface User {
  id: string;
  email: string | null;
  name: string | null;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  register: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  return axiosErr.response?.data?.error?.message ?? fallback;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isRestoring: true,
  error: null,

  register: async (email, password, name) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ data: AuthResponse }>('/auth/register', { email, password, name });
      const { accessToken, refreshToken, user } = response.data.data;
      await saveTokens(accessToken, refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractErrorMessage(err, 'Registrazione fallita') });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ data: AuthResponse }>('/auth/login', { email, password });
      const { accessToken, refreshToken, user } = response.data.data;
      await saveTokens(accessToken, refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: extractErrorMessage(err, 'Credenziali non valide') });
      throw err;
    }
  },

  loginWithGoogle: async () => {
    set({ isLoading: true, error: null });
    try {
      const idToken = await signInWithGoogle();
      const response = await api.post<{ data: AuthResponse }>('/auth/oauth/google', { idToken });
      const { accessToken, refreshToken, user } = response.data.data;
      await saveTokens(accessToken, refreshToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      if (err instanceof GoogleSignInCancelledError) {
        set({ isLoading: false });
      } else {
        set({ isLoading: false, error: extractErrorMessage(err, 'Login Google fallito') });
      }
      throw err;
    }
  },

  logout: async () => {
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken });
      }
    } catch {
      // logout lato server best-effort: procediamo comunque a pulire lo stato locale
    }
    await clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    set({ isRestoring: true });
    const accessToken = await getAccessToken();
    // Non esiste un endpoint "me": consideriamo valida la sessione se un token è presente;
    // l'interceptor di refresh gestirà comunque la scadenza alla prima chiamata reale.
    set({ isAuthenticated: !!accessToken, isRestoring: false });
  },
}));

setOnSessionExpired(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false });
});
