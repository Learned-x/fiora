import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { accountDeletionQueue } from '../lib/bullmq';

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const BCRYPT_ROUNDS = 12;

// ── Token helpers ─────────────────────────────────────────────────────────────

export function generateAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN as any,
  });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

export async function saveRefreshToken(userId: string, token: string): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });
}

// ── Register ──────────────────────────────────────────────────────────────────

export async function register(email: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw { code: 'AUTH_EMAIL_ALREADY_EXISTS', status: 409, message: 'Email già registrata' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, provider: 'email' },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();
  await saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    throw { code: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Credenziali non valide' };
  }

  if (user.deletedAt) {
    throw { code: 'AUTH_ACCOUNT_DELETED', status: 401, message: 'Account in fase di eliminazione' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw { code: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Credenziali non valide' };
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();
  await saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken, user: { id: user.id, email: user.email } };
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export async function refresh(token: string) {
  const existing = await prisma.refreshToken.findUnique({ where: { token } });

  if (!existing || existing.expiresAt < new Date()) {
    throw { code: 'AUTH_TOKEN_INVALID', status: 401, message: 'Refresh token non valido o scaduto' };
  }

  // Rotation: elimina il vecchio e crea un nuovo
  await prisma.refreshToken.delete({ where: { token } });

  const newAccessToken = generateAccessToken(existing.userId);
  const newRefreshToken = generateRefreshToken();
  await saveRefreshToken(existing.userId, newRefreshToken);

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(token: string) {
  await prisma.refreshToken.deleteMany({ where: { token } });
}

// ── Richiesta eliminazione account (periodo di grazia 30 giorni) ──────────────

export async function requestAccountDeletion(userId: string) {
  const graceUntil = new Date();
  graceUntil.setDate(graceUntil.getDate() + 30);
  const delayMs = graceUntil.getTime() - Date.now();

  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: graceUntil },
  });

  // Invalida tutti i refresh token
  await prisma.refreshToken.deleteMany({ where: { userId } });

  // Aggiungi alla blacklist Redis per invalidare gli access token attivi
  await redis.setex(`blacklist:${userId}`, 30 * 24 * 60 * 60, '1');

  // Pianifica l'eliminazione definitiva dopo il periodo di grazia
  await accountDeletionQueue.add(
    'delete-account',
    { userId },
    { delay: delayMs, jobId: `delete-account-${userId}` }
  );

  return { graceUntil };
}

// ── Annulla eliminazione account ──────────────────────────────────────────────

export async function cancelAccountDeletion(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: null },
  });

  await redis.del(`blacklist:${userId}`);

  // Rimuove il job schedulato per l'eliminazione definitiva, se presente
  const job = await accountDeletionQueue.getJob(`delete-account-${userId}`);
  if (job) await job.remove();
}
