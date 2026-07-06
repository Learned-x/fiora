jest.mock('../services/species.service');
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
import * as speciesService from '../services/species.service';

const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET!);
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

const SPECIES_ID = '33333333-3333-4333-8333-333333333333';

describe('Routes /species', () => {
  it('rifiuta senza token', async () => {
    const res = await request(app).get('/species');
    expect(res.status).toBe(401);
  });

  it('restituisce risultati con ricerca', async () => {
    (speciesService.listSpecies as jest.Mock).mockResolvedValue({
      items: [{ id: SPECIES_ID, nomeComune: 'Monstera deliciosa' }],
      total: 1,
      limit: 20,
      offset: 0,
    });

    const res = await auth(request(app).get('/species?search=monstera'));

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(1);
    expect(speciesService.listSpecies).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'monstera' })
    );
  });

  it('rifiuta limit fuori range', async () => {
    const res = await auth(request(app).get('/species?limit=100'));
    expect(res.status).toBe(400);
  });

  it('restituisce 404 per specie inesistente', async () => {
    (speciesService.getSpecies as jest.Mock).mockRejectedValue({
      code: 'SPECIES_NOT_FOUND',
      status: 404,
      message: 'Specie non trovata',
    });

    const res = await auth(request(app).get(`/species/${SPECIES_ID}`));

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('SPECIES_NOT_FOUND');
  });
});
