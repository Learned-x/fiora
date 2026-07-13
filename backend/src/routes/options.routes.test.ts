jest.mock('../services/app-option.service');
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
import * as appOptionService from '../services/app-option.service';

const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET!);
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

beforeEach(() => jest.clearAllMocks());

describe('GET /options', () => {
  it('rifiuta senza token', async () => {
    const res = await request(app).get('/options');
    expect(res.status).toBe(401);
  });

  it('restituisce tutte le opzioni', async () => {
    (appOptionService.listOptions as jest.Mock).mockResolvedValue([{ categoria: 'clima', chiave: 'freddo' }]);

    const res = await auth(request(app).get('/options'));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(appOptionService.listOptions).toHaveBeenCalledWith();
  });
});

describe('GET /options/:categoria', () => {
  it('restituisce le opzioni della categoria', async () => {
    (appOptionService.listOptions as jest.Mock).mockResolvedValue([]);

    const res = await auth(request(app).get('/options/clima'));

    expect(res.status).toBe(200);
    expect(appOptionService.listOptions).toHaveBeenCalledWith('clima');
  });
});
