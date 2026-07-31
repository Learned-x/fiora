import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { accountDeletionQueue, emailQueue } from '../lib/bullmq';
import { audit } from '../lib/audit';
import { logger } from '../lib/logger';

const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_DAYS = Number(process.env.REFRESH_TOKEN_EXPIRES_DAYS) || 30;
const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_EXPIRES_MINUTES = 30;

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

export async function register(email: string, password: string, name?: string, ip?: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw { code: 'AUTH_EMAIL_ALREADY_EXISTS', status: 409, message: 'Email già registrata' };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, passwordHash, name, provider: 'email' },
  });

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();
  await saveRefreshToken(user.id, refreshToken);

  audit('auth.register', { userId: user.id, email: user.email, ip });

  return { accessToken, refreshToken, user: { id: user.id, email: user.email, name: user.name } };
}

// ── Login ─────────────────────────────────────────────────────────────────────

function buildGracePeriod(deletedAt: Date | null) {
  if (!deletedAt) return undefined;
  const giorniRimanenti = Math.max(
    0,
    Math.ceil((deletedAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
  );
  return { active: true, deletedAt, giorniRimanenti };
}

export async function login(email: string, password: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    audit('auth.login.failure', { email, ip });
    throw { code: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Credenziali non valide' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    audit('auth.login.failure', { userId: user.id, email, ip });
    throw { code: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Credenziali non valide' };
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken();
  await saveRefreshToken(user.id, refreshToken);

  audit('auth.login.success', { userId: user.id, email, ip });

  const graceperiod = buildGracePeriod(user.deletedAt);

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, name: user.name },
    ...(graceperiod && { graceperiod }),
  };
}

// ── Profilo utente ────────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      clima: true,
      onboardingDone: true,
      mostraNomiScientifici: true,
      orarioReminder: true,
      pushToken: true,
      deletedAt: true,
    },
  });

  if (!user) {
    throw { code: 'USER_NOT_FOUND', status: 404, message: 'Utente non trovato' };
  }

  const { deletedAt, ...profile } = user;
  const graceperiod = buildGracePeriod(deletedAt);

  return { ...profile, ...(graceperiod && { graceperiod }) };
}

// ── Cambio password ───────────────────────────────────────────────────────────

export async function changePassword(userId: string, currentPassword: string, newPassword: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || !user.passwordHash) {
    throw { code: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Credenziali non valide' };
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    audit('auth.change_password', { userId, ip, meta: { esito: 'password_attuale_errata' } });
    throw { code: 'AUTH_INVALID_CREDENTIALS', status: 401, message: 'Password attuale non corretta' };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  audit('auth.change_password', { userId, ip, meta: { esito: 'ok' } });
}

// ── Recupero password ─────────────────────────────────────────────────────────

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Non rivela mai se l'email esiste: la risposta al chiamante è identica nei due casi.
export async function requestPasswordReset(email: string, ip?: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });

  // Chi ha fatto login solo con Google/Apple non ha una password Fiora da resettare.
  if (!user || !user.passwordHash) {
    audit('auth.password_reset.requested', { email, ip, meta: { esito: 'account_non_idoneo' } });
    return;
  }

  const token = crypto.randomBytes(32).toString('hex');
  const passwordResetTokenHash = hashResetToken(token);
  const passwordResetExpiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRES_MINUTES * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetTokenHash, passwordResetExpiresAt },
  });

  // URL http/https invece dello schema custom fiora:// nudo: molti client email
  // (Gmail incluso) non rendono cliccabili gli schemi custom nel corpo dell'email.
  // La pagina su /reset-password fa da fallback web e rilancia l'app (vedi app.ts).
  const resetUrl = `${process.env.APP_WEB_BASE_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  // Solo in dev/test: il token in chiaro non va mai in log/audit di staging o produzione.
  if (process.env.NODE_ENV !== 'production') {
    logger.info({ token, resetUrl }, 'Token reset password (solo dev/test)');
  }

  await emailQueue.add('password-reset', {
    to: email,
    subject: 'Reimposta la tua password Fiora',
    html: `<p>Hai chiesto di reimpostare la password del tuo account Fiora.</p><p><a href="${resetUrl}">Reimposta la password</a></p><p>Il link scade tra 30 minuti. Se non hai richiesto tu questa email, ignorala.</p>`,
    text: `Hai chiesto di reimpostare la password del tuo account Fiora.\n\nApri questo link per continuare: ${resetUrl}\n\nIl link scade tra 30 minuti. Se non hai richiesto tu questa email, ignorala.`,
  });

  // "accodata": il job email è stato messo in coda, non che l'email sia stata
  // consegnata — l'esito reale dell'invio è nell'evento auth.password_reset.email_sent,
  // loggato dal worker dopo la chiamata a Resend (vedi src/jobs/email.job.ts).
  audit('auth.password_reset.requested', { userId: user.id, email, ip, meta: { esito: 'accodata' } });
}

export async function resetPassword(token: string, newPassword: string, ip?: string): Promise<void> {
  const passwordResetTokenHash = hashResetToken(token);

  const user = await prisma.user.findFirst({ where: { passwordResetTokenHash } });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
    audit('auth.password_reset.completed', { ip, meta: { esito: 'token_non_valido' } });
    throw { code: 'AUTH_TOKEN_INVALID', status: 401, message: 'Link di reset non valido o scaduto' };
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
  });

  // Reset nato da un possibile accesso non autorizzato: chiude tutte le sessioni aperte.
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

  audit('auth.password_reset.completed', { userId: user.id, ip, meta: { esito: 'ok' } });
}

// ── Refresh token ─────────────────────────────────────────────────────────────

export async function refresh(token: string, ip?: string) {
  const existing = await prisma.refreshToken.findUnique({ where: { token } });

  if (!existing || existing.expiresAt < new Date()) {
    throw { code: 'AUTH_TOKEN_INVALID', status: 401, message: 'Refresh token non valido o scaduto' };
  }

  // Rotation: elimina il vecchio e crea un nuovo
  await prisma.refreshToken.delete({ where: { token } });

  const newAccessToken = generateAccessToken(existing.userId);
  const newRefreshToken = generateRefreshToken();
  await saveRefreshToken(existing.userId, newRefreshToken);

  audit('auth.refresh', { userId: existing.userId, ip });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(token: string, ip?: string) {
  const existing = await prisma.refreshToken.findUnique({ where: { token } });
  await prisma.refreshToken.deleteMany({ where: { token } });
  if (existing) audit('auth.logout', { userId: existing.userId, ip });
}

// ── Richiesta eliminazione account (periodo di grazia 30 giorni) ──────────────

export async function requestAccountDeletion(userId: string, ip?: string) {
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

  audit('auth.account_deletion.requested', { userId, ip, meta: { graceUntil } });

  return { graceUntil };
}

// ── Annulla eliminazione account ──────────────────────────────────────────────

export async function cancelAccountDeletion(userId: string, ip?: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { deletedAt: null },
  });

  await redis.del(`blacklist:${userId}`);

  // Rimuove il job schedulato per l'eliminazione definitiva, se presente
  const job = await accountDeletionQueue.getJob(`delete-account-${userId}`);
  if (job) await job.remove();

  audit('auth.account_deletion.cancelled', { userId, ip });
}
