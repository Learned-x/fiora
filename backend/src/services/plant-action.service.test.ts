jest.mock('../lib/prisma');
jest.mock('./plant.service', () => ({
  findOwnedPlant: jest.fn(),
}));

import * as plantActionService from './plant-action.service';
import { prisma } from '../lib/prisma';
import { findOwnedPlant } from './plant.service';

const PLANT_ID = 'plant-1';
const USER_ID = 'user-1';

beforeEach(() => jest.clearAllMocks());

describe('plant-action.service listPlantActions', () => {
  it('verifica ownership prima di interrogare l\'action log', async () => {
    (findOwnedPlant as jest.Mock).mockRejectedValue({ code: 'PLANT_NOT_FOUND', status: 404 });

    await expect(plantActionService.listPlantActions(USER_ID, PLANT_ID)).rejects.toMatchObject({
      code: 'PLANT_NOT_FOUND',
    });
    expect(prisma.actionLog.findMany).not.toHaveBeenCalled();
  });

  it('applica filtri tipo e periodo', async () => {
    (findOwnedPlant as jest.Mock).mockResolvedValue({ id: PLANT_ID });
    (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([{ id: 'action-1' }]);
    (prisma.actionLog.count as jest.Mock).mockResolvedValue(1);

    const result = await plantActionService.listPlantActions(USER_ID, PLANT_ID, {
      tipo: 'annaffiatura',
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-31T23:59:59Z',
    });

    expect(result).toEqual({ items: [{ id: 'action-1' }], total: 1, limit: 20, offset: 0 });
    const args = (prisma.actionLog.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.tipo).toBe('annaffiatura');
    expect(args.where.createdAt.gte).toEqual(new Date('2026-07-01T00:00:00Z'));
    expect(args.where.createdAt.lte).toEqual(new Date('2026-07-31T23:59:59Z'));
  });

  it('applica paginazione custom', async () => {
    (findOwnedPlant as jest.Mock).mockResolvedValue({ id: PLANT_ID });
    (prisma.actionLog.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.actionLog.count as jest.Mock).mockResolvedValue(0);

    const result = await plantActionService.listPlantActions(USER_ID, PLANT_ID, {}, { limit: 5, offset: 10 });

    expect(result.limit).toBe(5);
    expect(result.offset).toBe(10);
    expect(prisma.actionLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5, skip: 10 })
    );
  });
});
