jest.mock('../lib/prisma');

import * as taskService from './task.service';
import { prisma } from '../lib/prisma';

const mockPlant = { id: 'plant-1', userId: 'user-1', stato: 'attivo' };
const mockTask = {
  id: 'task-1',
  plantId: 'plant-1',
  userId: 'user-1',
  tipo: 'annaffiatura',
  stato: 'pending',
};

beforeEach(() => jest.clearAllMocks());

describe('task.service', () => {
  describe('createTask', () => {
    it('crea un task manuale su pianta dell\'utente', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(mockPlant);
      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

      const result = await taskService.createTask('user-1', 'plant-1', {
        tipo: 'annaffiatura',
        scadenza: '2026-07-10T09:00:00Z',
      });

      expect(result.tipo).toBe('annaffiatura');
      const args = (prisma.task.create as jest.Mock).mock.calls[0][0];
      expect(args.data.sorgente).toBe('manuale');
    });

    it('rifiuta se la pianta non è dell\'utente', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        taskService.createTask('user-1', 'plant-x', { tipo: 'annaffiatura', scadenza: '2026-07-10T09:00:00Z' })
      ).rejects.toMatchObject({ code: 'PLANT_NOT_FOUND' });
    });
  });

  describe('listTasks', () => {
    it('applica i filtri stato e periodo', async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([mockTask]);

      await taskService.listTasks('user-1', {
        stato: 'pending',
        from: '2026-07-01T00:00:00Z',
        to: '2026-07-31T23:59:59Z',
      });

      const args = (prisma.task.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where.userId).toBe('user-1');
      expect(args.where.stato).toBe('pending');
      expect(args.where.scadenza.gte).toEqual(new Date('2026-07-01T00:00:00Z'));
      expect(args.where.scadenza.lte).toEqual(new Date('2026-07-31T23:59:59Z'));
    });
  });

  describe('completeTask', () => {
    it('completa il task e crea un action log', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.task.update as jest.Mock).mockResolvedValue({ ...mockTask, stato: 'completato' });
      (prisma.actionLog.create as jest.Mock).mockResolvedValue({});

      const result = await taskService.completeTask('user-1', 'task-1', 'fatto');

      expect(result.stato).toBe('completato');
      expect(prisma.actionLog.create).toHaveBeenCalledWith({
        data: { plantId: 'plant-1', userId: 'user-1', tipo: 'annaffiatura', nota: 'fatto' },
      });
    });

    it('rifiuta se già completato', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue({ ...mockTask, stato: 'completato' });

      await expect(taskService.completeTask('user-1', 'task-1')).rejects.toMatchObject({
        code: 'TASK_ALREADY_COMPLETED',
      });
    });

    it('rifiuta se il task non è dell\'utente', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(taskService.completeTask('user-1', 'task-x')).rejects.toMatchObject({
        code: 'TASK_NOT_FOUND',
      });
    });
  });

  describe('postponeTask', () => {
    it('rimanda il task mantenendolo pending con nuova scadenza', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.task.update as jest.Mock).mockResolvedValue(mockTask);

      await taskService.postponeTask('user-1', 'task-1', '2026-07-15T09:00:00Z');

      const args = (prisma.task.update as jest.Mock).mock.calls[0][0];
      expect(args.data.stato).toBe('pending');
      expect(args.data.scadenza).toEqual(new Date('2026-07-15T09:00:00Z'));
    });
  });

  describe('skipTask', () => {
    it('imposta stato saltato', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.task.update as jest.Mock).mockResolvedValue({ ...mockTask, stato: 'saltato' });

      const result = await taskService.skipTask('user-1', 'task-1');

      expect(result.stato).toBe('saltato');
    });
  });

  describe('deleteTask', () => {
    it('elimina il task dopo verifica ownership', async () => {
      (prisma.task.findFirst as jest.Mock).mockResolvedValue(mockTask);
      (prisma.task.delete as jest.Mock).mockResolvedValue({});

      await taskService.deleteTask('user-1', 'task-1');

      expect(prisma.task.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } });
    });
  });
});
