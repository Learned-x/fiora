jest.mock('../services/plant.service');
jest.mock('../services/task.service', () => ({
  ...jest.requireActual('../services/task.service'),
  createTask: jest.fn(),
  listTasks: jest.fn(),
  completeTask: jest.fn(),
  postponeTask: jest.fn(),
  skipTask: jest.fn(),
  deleteTask: jest.fn(),
}));
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
import * as plantService from '../services/plant.service';
import * as taskService from '../services/task.service';

const token = jwt.sign({ sub: 'user-1' }, process.env.JWT_SECRET!);
const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

const PLANT_ID = '11111111-1111-4111-8111-111111111111';
const TASK_ID = '22222222-2222-4222-8222-222222222222';

describe('Routes /plants', () => {
  it('rifiuta senza token', async () => {
    const res = await request(app).get('/plants');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_MISSING');
  });

  describe('POST /plants', () => {
    it('crea una pianta con dati validi', async () => {
      (plantService.createPlant as jest.Mock).mockResolvedValue({ id: PLANT_ID, nome: 'Monstera' });

      const res = await auth(request(app).post('/plants')).send({ nome: 'Monstera', tipo: 'pianta' });

      expect(res.status).toBe(201);
      expect(res.body.data.nome).toBe('Monstera');
      expect(plantService.createPlant).toHaveBeenCalledWith('user-1', expect.objectContaining({ nome: 'Monstera' }));
    });

    it('restituisce 400 con tipo non valido', async () => {
      const res = await auth(request(app).post('/plants')).send({ nome: 'X', tipo: 'albero' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('restituisce 400 senza nome', async () => {
      const res = await auth(request(app).post('/plants')).send({ tipo: 'pianta' });

      expect(res.status).toBe(400);
    });

    it('propaga SPECIES_NOT_FOUND dal service', async () => {
      (plantService.createPlant as jest.Mock).mockRejectedValue({
        code: 'SPECIES_NOT_FOUND',
        status: 404,
        message: 'Specie non trovata',
      });

      const res = await auth(request(app).post('/plants')).send({
        nome: 'Monstera',
        tipo: 'pianta',
        speciesId: PLANT_ID,
      });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SPECIES_NOT_FOUND');
    });
  });

  describe('GET /plants', () => {
    it('restituisce la lista piante', async () => {
      (plantService.listPlants as jest.Mock).mockResolvedValue([{ id: PLANT_ID }]);

      const res = await auth(request(app).get('/plants'));

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(plantService.listPlants).toHaveBeenCalledWith('user-1', 'attivo');
    });

    it('accetta filtro stato archiviato', async () => {
      (plantService.listPlants as jest.Mock).mockResolvedValue([]);

      const res = await auth(request(app).get('/plants?stato=archiviato'));

      expect(res.status).toBe(200);
      expect(plantService.listPlants).toHaveBeenCalledWith('user-1', 'archiviato');
    });

    it('rifiuta stato non valido', async () => {
      const res = await auth(request(app).get('/plants?stato=eliminato'));
      expect(res.status).toBe(400);
    });
  });

  describe('GET /plants/:id', () => {
    it('restituisce 404 se non trovata', async () => {
      (plantService.getPlant as jest.Mock).mockRejectedValue({
        code: 'PLANT_NOT_FOUND',
        status: 404,
        message: 'Pianta non trovata',
      });

      const res = await auth(request(app).get(`/plants/${PLANT_ID}`));

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLANT_NOT_FOUND');
    });

    it('rifiuta id non uuid', async () => {
      const res = await auth(request(app).get('/plants/abc'));
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /plants/:id', () => {
    it('aggiorna la pianta', async () => {
      (plantService.updatePlant as jest.Mock).mockResolvedValue({ id: PLANT_ID, nome: 'Nuovo' });

      const res = await auth(request(app).patch(`/plants/${PLANT_ID}`)).send({ nome: 'Nuovo' });

      expect(res.status).toBe(200);
      expect(res.body.data.nome).toBe('Nuovo');
    });

    it('rifiuta stato eliminato via PATCH', async () => {
      const res = await auth(request(app).patch(`/plants/${PLANT_ID}`)).send({ stato: 'eliminato' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /plants/:id', () => {
    it('elimina la pianta', async () => {
      (plantService.deletePlant as jest.Mock).mockResolvedValue(undefined);

      const res = await auth(request(app).delete(`/plants/${PLANT_ID}`));

      expect(res.status).toBe(200);
      expect(plantService.deletePlant).toHaveBeenCalledWith('user-1', PLANT_ID);
    });
  });

  describe('POST /plants/:id/tasks', () => {
    it('crea un task valido', async () => {
      (taskService.createTask as jest.Mock).mockResolvedValue({ id: TASK_ID, tipo: 'annaffiatura' });

      const res = await auth(request(app).post(`/plants/${PLANT_ID}/tasks`)).send({
        tipo: 'annaffiatura',
        scadenza: '2026-07-10T09:00:00Z',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.tipo).toBe('annaffiatura');
    });

    it('rifiuta tipo task non valido', async () => {
      const res = await auth(request(app).post(`/plants/${PLANT_ID}/tasks`)).send({
        tipo: 'ballare',
        scadenza: '2026-07-10T09:00:00Z',
      });

      expect(res.status).toBe(400);
    });

    it('rifiuta senza scadenza', async () => {
      const res = await auth(request(app).post(`/plants/${PLANT_ID}/tasks`)).send({ tipo: 'annaffiatura' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /plants/:id/tasks', () => {
    it('lista i task della pianta', async () => {
      (plantService.findOwnedPlant as jest.Mock).mockResolvedValue({ id: PLANT_ID });
      (taskService.listTasks as jest.Mock).mockResolvedValue([{ id: TASK_ID }]);

      const res = await auth(request(app).get(`/plants/${PLANT_ID}/tasks?stato=pending`));

      expect(res.status).toBe(200);
      expect(taskService.listTasks).toHaveBeenCalledWith('user-1', { plantId: PLANT_ID, stato: 'pending' });
    });
  });
});

describe('Routes /tasks', () => {
  describe('GET /tasks', () => {
    it('restituisce i task con filtri', async () => {
      (taskService.listTasks as jest.Mock).mockResolvedValue([]);

      const res = await auth(request(app).get('/tasks?stato=pending&from=2026-07-01T00:00:00Z'));

      expect(res.status).toBe(200);
      expect(taskService.listTasks).toHaveBeenCalledWith('user-1', {
        stato: 'pending',
        from: '2026-07-01T00:00:00Z',
        to: undefined,
      });
    });
  });

  describe('PATCH /tasks/:id', () => {
    it('completa un task', async () => {
      (taskService.completeTask as jest.Mock).mockResolvedValue({ id: TASK_ID, stato: 'completato' });

      const res = await auth(request(app).patch(`/tasks/${TASK_ID}`)).send({ azione: 'completa' });

      expect(res.status).toBe(200);
      expect(res.body.data.stato).toBe('completato');
    });

    it('rimanda richiede scadenza', async () => {
      const res = await auth(request(app).patch(`/tasks/${TASK_ID}`)).send({ azione: 'rimanda' });
      expect(res.status).toBe(400);
    });

    it('rimanda con scadenza valida', async () => {
      (taskService.postponeTask as jest.Mock).mockResolvedValue({ id: TASK_ID, stato: 'pending' });

      const res = await auth(request(app).patch(`/tasks/${TASK_ID}`)).send({
        azione: 'rimanda',
        scadenza: '2026-07-15T09:00:00Z',
      });

      expect(res.status).toBe(200);
      expect(taskService.postponeTask).toHaveBeenCalledWith('user-1', TASK_ID, '2026-07-15T09:00:00Z');
    });

    it('rifiuta azione non valida', async () => {
      const res = await auth(request(app).patch(`/tasks/${TASK_ID}`)).send({ azione: 'esplodi' });
      expect(res.status).toBe(400);
    });

    it('propaga TASK_ALREADY_COMPLETED', async () => {
      (taskService.completeTask as jest.Mock).mockRejectedValue({
        code: 'TASK_ALREADY_COMPLETED',
        status: 409,
        message: 'Task già completato',
      });

      const res = await auth(request(app).patch(`/tasks/${TASK_ID}`)).send({ azione: 'completa' });

      expect(res.status).toBe(409);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('elimina un task', async () => {
      (taskService.deleteTask as jest.Mock).mockResolvedValue(undefined);

      const res = await auth(request(app).delete(`/tasks/${TASK_ID}`));

      expect(res.status).toBe(200);
    });
  });
});
