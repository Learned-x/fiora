import { api } from './api';
import type { AppOption, Clima, UserProfile } from '../types/models';

// ── Profilo ───────────────────────────────────────────────────────────────────

export async function getMe(): Promise<UserProfile> {
  const res = await api.get<{ data: UserProfile }>('/auth/me');
  return res.data.data;
}

export interface UpdateProfileInput {
  name?: string;
  clima?: Clima;
  mostraNomiScientifici?: boolean;
  orarioReminder?: string;
  onboardingDone?: boolean;
  pushToken?: string | null;
}

export async function updateMe(input: UpdateProfileInput): Promise<UserProfile> {
  const res = await api.patch<{ data: UserProfile }>('/users/me', input);
  return res.data.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.post('/auth/change-password', { currentPassword, newPassword });
}

export async function cancelAccountDeletion(): Promise<void> {
  await api.post('/auth/account/cancel-deletion');
}

// ── Opzioni dinamiche ─────────────────────────────────────────────────────────

export async function listOptions(categoria?: string): Promise<AppOption[]> {
  const res = await api.get<{ data: AppOption[] }>(categoria ? `/options/${categoria}` : '/options');
  return res.data.data;
}
