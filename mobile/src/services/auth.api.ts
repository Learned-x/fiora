import { api } from './api';

export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

export async function changeEmail(newEmail: string, currentPassword: string): Promise<void> {
  await api.post('/auth/change-email', { newEmail, currentPassword });
}

export async function verifyEmail(token: string): Promise<void> {
  await api.post('/auth/verify-email', { token });
}
