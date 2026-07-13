jest.mock('../services/user.service');
jest.mock('../services/oauth.service', () => ({
  loginWithGoogle: jest.fn(),
  loginWithApple: jest.fn(),
}));
jest.mock('../lib/mqtt', () => ({ connectMqtt: jest.fn() }));
jest.mock('../lib/bullmq');
jest.mock('../lib/redis');
jest.mock('../lib/prisma');

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import * as userService from '../services/user.service';

const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET!);
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

beforeEach(() => jest.clearAllMocks());

describe('PATCH /users/me', () => {
  it('rifiuta senza token', async () => {
    const res = await request(app).patch('/users/me').send({ name: 'Nuovo' });
    expect(res.status).toBe(401);
  });

  it('aggiorna il profilo con dati validi', async () => {
    (userService.updateProfile as jest.Mock).mockResolvedValue({ id: 'user-1', name: 'Nuovo' });

    const res = await auth(request(app).patch('/users/me')).send({ name: 'Nuovo' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Nuovo');
  });

  it('rifiuta clima non valido', async () => {
    const res = await auth(request(app).patch('/users/me')).send({ clima: 'artico' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('accetta clima valido', async () => {
    (userService.updateProfile as jest.Mock).mockResolvedValue({ id: 'user-1', clima: 'tropicale' });

    const res = await auth(request(app).patch('/users/me')).send({ clima: 'tropicale' });

    expect(res.status).toBe(200);
  });

  it('accetta pushToken stringa', async () => {
    (userService.updateProfile as jest.Mock).mockResolvedValue({
      id: 'user-1',
      pushToken: 'ExponentPushToken[abc]',
    });

    const res = await auth(request(app).patch('/users/me')).send({
      pushToken: 'ExponentPushToken[abc]',
    });

    expect(res.status).toBe(200);
    expect((userService.updateProfile as jest.Mock).mock.calls[0][1].pushToken).toBe(
      'ExponentPushToken[abc]'
    );
  });

  it('accetta pushToken null per disattivare le notifiche', async () => {
    (userService.updateProfile as jest.Mock).mockResolvedValue({ id: 'user-1', pushToken: null });

    const res = await auth(request(app).patch('/users/me')).send({ pushToken: null });

    expect(res.status).toBe(200);
    expect((userService.updateProfile as jest.Mock).mock.calls[0][1].pushToken).toBeNull();
  });

  it('rifiuta pushToken non stringa', async () => {
    const res = await auth(request(app).patch('/users/me')).send({ pushToken: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
