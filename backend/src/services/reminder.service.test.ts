jest.mock('../lib/prisma');

import { prisma } from '../lib/prisma';
import {
  generateWateringReminders,
  generateFertilizingReminders,
  generateBouquetReminders,
  recalcolaStatoBouquet,
  calcolaProssimaScadenza,
  ricalcolaScadenzeClima,
  ricalcolaScadenzaAnnaffiaturaPianta,
} from './reminder.service';

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
        user: { clima: 'temperato' },
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
        user: { clima: 'temperato' },
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
        user: { clima: 'temperato' },
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
        user: { clima: 'temperato' },
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
        user: { clima: 'temperato' },
        tasks: [],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(0);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('genera task per pianta senza specie ma con annaffiaturaCura manuale', async () => {
    const vecchiaData = new Date();
    vecchiaData.setDate(vecchiaData.getDate() - 10);

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: vecchiaData,
        species: null,
        annaffiaturaCura: 'media',
        user: { clima: 'temperato' },
        tasks: [],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(1);
  });

  it('annaffiaturaCura sulla pianta vince sul valore della specie', async () => {
    const vecchiaData = new Date();
    vecchiaData.setDate(vecchiaData.getDate() - 3); // oltre i 2gg di 'frequente', non i 10gg di 'poca'

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: vecchiaData,
        species: { annaffiatura: 'poca' },
        annaffiaturaCura: 'frequente',
        user: { clima: 'temperato' },
        tasks: [],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(1);
  });

  it('filtra piante attive con specie o cura manuale a livello query', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([]);

    await generateWateringReminders();

    expect(prisma.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stato: 'attivo', OR: [{ speciesId: { not: null } }, { annaffiaturaCura: { not: null } }] },
      })
    );
  });

  it('applica il fattore clima ritardando la scadenza per clima freddo', async () => {
    const vecchiaData = new Date();
    vecchiaData.setDate(vecchiaData.getDate() - 6); // 6gg fa, base 5gg 'media' già scaduta senza fattore

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        createdAt: vecchiaData,
        species: { annaffiatura: 'media' },
        user: { clima: 'freddo' }, // fattore 1.3 → intervallo 7gg, non ancora scaduto
        tasks: [],
      },
    ]);

    const result = await generateWateringReminders();

    expect(result.created).toBe(0);
  });
});

describe('reminder.service calcolaProssimaScadenza', () => {
  const riferimento = new Date('2026-01-01T00:00:00.000Z');

  it('applica il fattore clima e arrotonda', () => {
    const scadenza = calcolaProssimaScadenza(riferimento, 'media', 'freddo');
    // base 5 * 1.3 = 6.5 → round 7
    expect(scadenza?.toISOString().slice(0, 10)).toBe('2026-01-08');
  });

  it('applica minimo 1 giorno', () => {
    const scadenza = calcolaProssimaScadenza(riferimento, 'frequente', 'tropicale');
    // base 2 * 0.7 = 1.4 → round 1
    expect(scadenza?.toISOString().slice(0, 10)).toBe('2026-01-02');
  });

  it('ritorna null per annaffiatura non mappata', () => {
    expect(calcolaProssimaScadenza(riferimento, 'sconosciuta', 'temperato')).toBeNull();
  });

  it('usa fattore 1.0 per clima non mappato', () => {
    const scadenza = calcolaProssimaScadenza(riferimento, 'media', 'sconosciuto');
    expect(scadenza?.toISOString().slice(0, 10)).toBe('2026-01-06');
  });
});

describe('reminder.service generateFertilizingReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('genera task se il mese è nel range marzo-ottobre', async () => {
    const vecchiaData = new Date('2026-03-01T00:00:00.000Z');
    vecchiaData.setDate(vecchiaData.getDate() - 31);

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      { id: PLANT_ID, userId: USER_ID, createdAt: vecchiaData, tasks: [] },
    ]);

    const result = await generateFertilizingReminders(new Date('2026-03-01T00:00:00.000Z'));

    expect(result.created).toBe(1);
    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'concimazione' }) })
    );
  });

  it('non genera task fuori dal range marzo-ottobre', async () => {
    const result = await generateFertilizingReminders(new Date('2026-01-15T00:00:00.000Z'));

    expect(result).toEqual({ checked: 0, created: 0 });
    expect(prisma.plant.findMany).not.toHaveBeenCalled();
  });
});

describe('reminder.service generateBouquetReminders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('genera cambio_acqua e controllo_stato se non esiste storico', async () => {
    const vecchiaData = new Date();
    vecchiaData.setDate(vecchiaData.getDate() - 5);

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      { id: PLANT_ID, userId: USER_ID, dataRicezione: vecchiaData, createdAt: vecchiaData, tasks: [] },
    ]);

    const result = await generateBouquetReminders();

    expect(result.created).toBe(2);
  });

  it('esclude bouquet conclusi a livello query', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([]);

    await generateBouquetReminders();

    expect(prisma.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tipo: 'bouquet', stato: 'attivo', statoBouquet: { not: 'concluso' } },
      })
    );
  });

  it('non duplica task già pending', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      {
        id: PLANT_ID,
        userId: USER_ID,
        dataRicezione: new Date('2020-01-01'),
        createdAt: new Date('2020-01-01'),
        tasks: [
          { tipo: 'cambio_acqua', stato: 'pending', completatoA: null, createdAt: new Date() },
          { tipo: 'controllo_stato', stato: 'pending', completatoA: null, createdAt: new Date() },
        ],
      },
    ]);

    const result = await generateBouquetReminders();

    expect(result.created).toBe(0);
  });
});

describe('reminder.service recalcolaStatoBouquet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [0, 'fresco'],
    [2, 'fresco'],
    [3, 'in_cura'],
    [6, 'in_cura'],
    [7, 'appassendo'],
    [10, 'appassendo'],
    [11, 'concluso'],
  ])('imposta statoBouquet corretto per %i giorni trascorsi', async (giorni, atteso) => {
    const dataRicezione = new Date();
    dataRicezione.setDate(dataRicezione.getDate() - giorni);

    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      { id: PLANT_ID, dataRicezione, createdAt: dataRicezione, statoBouquet: 'diverso' },
    ]);

    await recalcolaStatoBouquet();

    expect(prisma.plant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: PLANT_ID },
        data: { statoBouquet: atteso },
      })
    );
  });

  it('rispetta statoBouquetManuale escludendolo a livello query', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([]);

    await recalcolaStatoBouquet();

    expect(prisma.plant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tipo: 'bouquet', stato: 'attivo', statoBouquetManuale: false },
      })
    );
  });

  it('non aggiorna se lo stato calcolato è invariato', async () => {
    (prisma.plant.findMany as jest.Mock).mockResolvedValue([
      { id: PLANT_ID, dataRicezione: new Date(), createdAt: new Date(), statoBouquet: 'fresco' },
    ]);

    await recalcolaStatoBouquet();

    expect(prisma.plant.update).not.toHaveBeenCalled();
  });
});

describe('reminder.service ricalcolaScadenzeClima', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ricalcola la scadenza dei task pending annaffiatura/calendario', async () => {
    const taskId = '33333333-3333-4333-8333-333333333333';
    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      {
        id: taskId,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        plant: { species: { annaffiatura: 'media' } },
      },
    ]);

    const result = await ricalcolaScadenzeClima(USER_ID, 'tropicale');

    expect(result.aggiornati).toBe(1);
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: taskId } })
    );
  });

  it('esclude piante con vaso smart a livello query', async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    await ricalcolaScadenzeClima(USER_ID, 'tropicale');

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          plant: { vasoId: null, stato: 'attivo' },
        }),
      })
    );
  });
});

describe('reminder.service ricalcolaScadenzaAnnaffiaturaPianta', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ricalcola la scadenza del task pending usando oggi come riferimento', async () => {
    const taskId = '44444444-4444-4444-8444-444444444444';
    (prisma.task.findFirst as jest.Mock).mockResolvedValue({
      id: taskId,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    });

    const now = new Date('2026-08-18T10:00:00.000Z');
    const result = await ricalcolaScadenzaAnnaffiaturaPianta(PLANT_ID, 'media', 'temperato', now);

    expect(result).toBe(true);
    const attesa = new Date(now);
    attesa.setDate(attesa.getDate() + 5); // media=5gg, fattore temperato=1.0
    expect(prisma.task.update).toHaveBeenCalledWith({
      where: { id: taskId },
      data: { scadenza: attesa },
    });
  });

  it('non fa nulla se non esiste un task pending annaffiatura/calendario', async () => {
    (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await ricalcolaScadenzaAnnaffiaturaPianta(PLANT_ID, 'media', 'temperato');

    expect(result).toBe(false);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('cerca solo task pending di sorgente calendario per la pianta', async () => {
    (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);

    await ricalcolaScadenzaAnnaffiaturaPianta(PLANT_ID, 'media', 'temperato');

    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { plantId: PLANT_ID, tipo: 'annaffiatura', sorgente: 'calendario', stato: 'pending' },
    });
  });
});
