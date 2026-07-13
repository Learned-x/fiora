jest.mock('../services/auth.service');
jest.mock('../services/oauth.service', () => ({
  loginWithGoogle: jest.fn(),
  loginWithApple: jest.fn(),
}));
jest.mock('../lib/mqtt', () => ({ connectMqtt: jest.fn() }));
jest.mock('../lib/bullmq');
jest.mock('../lib/redis');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import * as authService from '../services/auth.service';

const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET!);
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

describe('POST /auth/register', () => {
  it('restituisce 201 con dati validi', async () => {
    (authService.register as jest.Mock).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: '1', email: 'test@fiora.app' },
    });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@fiora.app', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('test@fiora.app');
  });

  it('restituisce 400 con email non valida', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('restituisce 400 con password troppo corta', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@fiora.app', password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('propaga errore AUTH_EMAIL_ALREADY_EXISTS dal service', async () => {
    (authService.register as jest.Mock).mockRejectedValue({
      code: 'AUTH_EMAIL_ALREADY_EXISTS',
      status: 409,
      message: 'Email già registrata',
    });

    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@fiora.app', password: 'password123' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('AUTH_EMAIL_ALREADY_EXISTS');
  });
});

describe('POST /auth/login', () => {
  it('restituisce 200 con credenziali valide', async () => {
    (authService.login as jest.Mock).mockResolvedValue({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: '1', email: 'test@fiora.app' },
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@fiora.app', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('restituisce 401 con credenziali invalide', async () => {
    (authService.login as jest.Mock).mockRejectedValue({
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
      message: 'Credenziali non valide',
    });

    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'test@fiora.app', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });
});

describe('POST /auth/refresh', () => {
  it('restituisce 400 senza refreshToken', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('restituisce nuovi token con refreshToken valido', async () => {
    (authService.refresh as jest.Mock).mockResolvedValue({ accessToken: 'a2', refreshToken: 'r2' });

    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'r' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('a2');
  });
});

describe('POST /auth/logout', () => {
  it('restituisce 200 e conferma logout', async () => {
    (authService.logout as jest.Mock).mockResolvedValue(undefined);

    const res = await request(app).post('/auth/logout').send({ refreshToken: 'r' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /auth/account', () => {
  it('restituisce 401 senza token', async () => {
    const res = await request(app).delete('/auth/account');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_MISSING');
  });
});

describe('GET /auth/me', () => {
  it('restituisce 401 senza token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('restituisce il profilo con token valido', async () => {
    (authService.getProfile as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'test@fiora.app',
      clima: 'temperato',
    });

    const res = await auth(request(app).get('/auth/me'));

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('test@fiora.app');
  });
});

describe('POST /auth/change-password', () => {
  it('restituisce 401 senza token', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .send({ currentPassword: 'a', newPassword: 'nuovaPassword123' });

    expect(res.status).toBe(401);
  });

  it('restituisce 400 con newPassword troppo corta', async () => {
    const res = await auth(request(app).post('/auth/change-password')).send({
      currentPassword: 'vecchia',
      newPassword: '123',
    });

    expect(res.status).toBe(400);
  });

  it('aggiorna la password con dati validi', async () => {
    (authService.changePassword as jest.Mock).mockResolvedValue(undefined);

    const res = await auth(request(app).post('/auth/change-password')).send({
      currentPassword: 'vecchia123',
      newPassword: 'nuovaPassword123',
    });

    expect(res.status).toBe(200);
  });

  it('propaga AUTH_INVALID_CREDENTIALS se la password attuale è errata', async () => {
    (authService.changePassword as jest.Mock).mockRejectedValue({
      code: 'AUTH_INVALID_CREDENTIALS',
      status: 401,
      message: 'Password attuale non corretta',
    });

    const res = await auth(request(app).post('/auth/change-password')).send({
      currentPassword: 'sbagliata',
      newPassword: 'nuovaPassword123',
    });

    expect(res.status).toBe(401);
  });
});
