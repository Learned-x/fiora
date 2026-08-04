import { create } from 'zustand';
import { AxiosError } from 'axios';
import { api, setOnSessionExpired } from '../services/api';
import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from '../services/storage';
import { GoogleSignInCancelledError, signInWithGoogle, AppleSignInCancelledError, signInWithApple } from '../services/oauth';
import { getMe } from '../services/user.api';
import type { GracePeriod, UserProfile } from '../types/models';

interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  graceperiod?: GracePeriod;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface AuthState {
  user: AuthUser | null;
  profile: UserProfile | null;
  graceperiod: GracePeriod | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean;
  error: string | null;
  register: (email: string, password: string, name?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearGracePeriod: () => void;
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<ApiErrorBody>;
  return axiosErr.response?.data?.error?.message ?? fallback;
}

// Dopo un'autenticazione riuscita carica il profilo completo da /auth/me
// (serve anche al gate onboarding). Best-effort: un errore qui non blocca il login.
async function syncProfileAfterAuth(set: (partial: Partial<AuthState>) => void) {
  try {
    const profile = await getMe();
    set({ profile });
  } catch {
    // Il profilo verrà ricaricato alla prossima occasione (restoreSession / refreshProfile)
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  graceperiod: null,
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
      await syncProfileAfterAuth(set);
    } catch (err) {
      set({ isLoading: false, error: extractErrorMessage(err, 'Registrazione fallita') });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<{ data: AuthResponse }>('/auth/login', { email, password });
      const { accessToken, refreshToken, user, graceperiod } = response.data.data;
      await saveTokens(accessToken, refreshToken);
      set({ user, graceperiod: graceperiod ?? null, isAuthenticated: true, isLoading: false });
      await syncProfileAfterAuth(set);
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
      const { accessToken, refreshToken, user, graceperiod } = response.data.data;
      await saveTokens(accessToken, refreshToken);
      set({ user, graceperiod: graceperiod ?? null, isAuthenticated: true, isLoading: false });
      await syncProfileAfterAuth(set);
    } catch (err) {
      if (err instanceof GoogleSignInCancelledError) {
        set({ isLoading: false });
      } else {
        set({ isLoading: false, error: extractErrorMessage(err, 'Login Google fallito') });
      }
      throw err;
    }
  },

  loginWithApple: async () => {
    set({ isLoading: true, error: null });
    try {
      const { identityToken, fullName } = await signInWithApple();
      const response = await api.post<{ data: AuthResponse }>('/auth/oauth/apple', { identityToken, fullName });
      const { accessToken, refreshToken, user, graceperiod } = response.data.data;
      await saveTokens(accessToken, refreshToken);
      set({ user, graceperiod: graceperiod ?? null, isAuthenticated: true, isLoading: false });
      await syncProfileAfterAuth(set);
    } catch (err) {
      if (err instanceof AppleSignInCancelledError) {
        set({ isLoading: false });
      } else {
        set({ isLoading: false, error: extractErrorMessage(err, 'Login Apple fallito') });
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
    set({ user: null, profile: null, graceperiod: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    set({ isRestoring: true });
    const accessToken = await getAccessToken();
    if (!accessToken) {
      set({ isAuthenticated: false, isRestoring: false });
      return;
    }
    set({ isAuthenticated: true });
    try {
      const profile = await getMe();
      set({
        profile,
        user: { id: profile.id, email: profile.email, name: profile.name },
        graceperiod: profile.graceperiod ?? null,
        isRestoring: false,
      });
    } catch {
      // Token presente ma /auth/me fallito (es. offline): la sessione resta valida,
      // l'interceptor di refresh gestirà l'eventuale scadenza alla prima chiamata reale.
      set({ isRestoring: false });
    }
  },

  refreshProfile: async () => {
    const profile = await getMe();
    set({
      profile,
      user: { id: profile.id, email: profile.email, name: profile.name },
      graceperiod: profile.graceperiod ?? null,
    });
  },

  clearGracePeriod: () => set({ graceperiod: null }),
}));

setOnSessionExpired(() => {
  useAuthStore.setState({ user: null, profile: null, graceperiod: null, isAuthenticated: false });
});
