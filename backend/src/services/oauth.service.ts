import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { generateAccessToken, generateRefreshToken, saveRefreshToken } from './auth.service';
import { audit } from '../lib/audit';

const googleClient = new OAuth2Client();

const googleAudiences = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_IOS_CLIENT_ID].filter(
  (id): id is string => !!id
);

const appleJwks = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000,
});

function getAppleSigningKey(header: jwt.JwtHeader): Promise<string> {
  return new Promise((resolve, reject) => {
    appleJwks.getSigningKey(header.kid!, (err, key) => {
      if (err || !key) return reject(err || new Error('Chiave Apple non trovata'));
      resolve(key.getPublicKey());
    });
  });
}

// ── Trova o crea l'utente in base a provider + email ──────────────────────────

async function findOrCreateOAuthUser(
  provider: 'google' | 'apple',
  providerId: string,
  email: string | null,
  name: string | null
) {
  // 1. Utente già collegato a questo provider
  let user = await prisma.user.findFirst({ where: { provider, providerId } });
  if (user) {
    // Backfill del nome se mancante (es. utenti creati prima del campo name)
    if (!user.name && name) {
      user = await prisma.user.update({ where: { id: user.id }, data: { name } });
    }
    return user;
  }

  // 2. Account email esistente con la stessa email → collega i due account
  if (email) {
    user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      return prisma.user.update({
        where: { id: user.id },
        data: { provider, providerId, name: user.name ?? name },
      });
    }
  }

  // 3. Nuovo utente
  return prisma.user.create({
    data: { email: email ?? undefined, name: name ?? undefined, provider, providerId },
  });
}

async function issueTokensFor(userId: string) {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken();
  await saveRefreshToken(userId, refreshToken);
  return { accessToken, refreshToken };
}

// ── Login con Google ───────────────────────────────────────────────────────────

export async function loginWithGoogle(idToken: string, ip?: string) {
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: googleAudiences,
    });
    payload = ticket.getPayload();
  } catch {
    audit('auth.login.failure', { ip, meta: { provider: 'google' } });
    throw { code: 'AUTH_OAUTH_FAILED', status: 401, message: 'Token Google non valido' };
  }

  if (!payload?.sub) {
    audit('auth.login.failure', { ip, meta: { provider: 'google' } });
    throw { code: 'AUTH_OAUTH_FAILED', status: 401, message: 'Token Google non valido' };
  }

  const user = await findOrCreateOAuthUser('google', payload.sub, payload.email ?? null, payload.name ?? null);
  const tokens = await issueTokensFor(user.id);

  audit('auth.login.success', { userId: user.id, email: user.email ?? undefined, ip, meta: { provider: 'google' } });

  return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
}

// ── Login con Apple ────────────────────────────────────────────────────────────

export async function loginWithApple(identityToken: string, ip?: string) {
  let decoded: jwt.JwtPayload;
  try {
    const header = jwt.decode(identityToken, { complete: true })?.header;
    if (!header) throw new Error('Token malformato');

    const publicKey = await getAppleSigningKey(header);
    decoded = jwt.verify(identityToken, publicKey, {
      algorithms: ['RS256'],
      audience: process.env.APPLE_CLIENT_ID,
      issuer: 'https://appleid.apple.com',
    }) as jwt.JwtPayload;
  } catch {
    audit('auth.login.failure', { ip, meta: { provider: 'apple' } });
    throw { code: 'AUTH_OAUTH_FAILED', status: 401, message: 'Token Apple non valido' };
  }

  if (!decoded.sub) {
    audit('auth.login.failure', { ip, meta: { provider: 'apple' } });
    throw { code: 'AUTH_OAUTH_FAILED', status: 401, message: 'Token Apple non valido' };
  }

  // Apple fornisce l'email solo al primo login (o nel body della richiesta come fallback)
  const email = (decoded.email as string | undefined) ?? null;

  // Apple non include il nome nel token: arriverà solo dal body al primo login (gestito in futuro)
  const user = await findOrCreateOAuthUser('apple', decoded.sub, email, null);
  const tokens = await issueTokensFor(user.id);

  audit('auth.login.success', { userId: user.id, email: user.email ?? undefined, ip, meta: { provider: 'apple' } });

  return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
}
