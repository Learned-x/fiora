jest.mock('../lib/prisma');

import { prisma } from '../lib/prisma';
import { generateWateringReminders } from './reminder.service';

const PLANT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('reminder.service generateWateringReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('crea task calendario se non esiste storico e pianta creata oltre intervallo fa', async () => {
    const vecchiaData = new Date();
    vecchiaData.setDate(vecchiaData.getDate() - 10); // oltre i 5gg di 'media'

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: vecchiaData,
        species: { annaffiatura: 'media' },
        tasks: [],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result).toEqual({ checked: 1, created: 1 });
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          plantId: PLANT_ID,
          userId: USER_ID,
          tipo: 'annaffiatura',
          sorgente: 'calendario',
          stato: 'pending',
        }),
      })
    );
  });

  it('non crea task se esiste già uno pending', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: new Date('2020-01-01'),
        species: { annaffiatura: 'media' },
        tasks: [{ stato: 'pending', completatoA: null, createdAt: new Date() }],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(0);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('non crea task se ultimo completamento è troppo recente', async () => {
    const oggi = new Date();

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: new Date('2020-01-01'),
        species: { annaffiatura: 'media' },
        tasks: [{ stato: 'completato', completatoA: oggi, createdAt: oggi }],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(0);
  });

  it('crea task se ultimo completamento supera intervallo', async () => {
    const completatoA = new Date();
    completatoA.setDate(completatoA.getDate() - 6); // oltre i 5gg di 'media'

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: new Date('2020-01-01'),
        species: { annaffiatura: 'media' },
        tasks: [{ stato: 'completato', completatoA, createdAt: completatoA }],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(1);
  });

  it('ignora piante senza mapping annaffiatura valido', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: new Date('2020-01-01'),
        species: { annaffiatura: 'sconosciuta' },
        tasks: [],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(0);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('filtra piante attive con specie a livello query', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([]);

    await generateWateringReminders();

    expect(prisma.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stato: 'attivo', speciesId: { not: null } },
      })
    );
  });
});
