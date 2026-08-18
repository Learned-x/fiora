jest.mock('../lib/prisma');

import * as plantService from './plant.service';
import { prisma } from '../lib/prisma';

// speciesId valorizzato di default: la maggior parte dei test updatePlant non
// riguarda la cura manuale, e senza specie la validazione PLANT_CURA_INCOMPLETA
// la richiederebbe per ogni test. I test specifici sulla cura manuale usano
// il proprio mock con speciesId: null.
const mockPlant = {
  id: 'plant-1',
  userId: 'user-1',
  nome: 'Monstera',
  tipo: 'pianta',
  stato: 'attivo',
  speciesId: 'species-1',
  vasoId: null,
  luceCura: null,
  annaffiaturaCura: null,
  umiditaCura: null,
};

beforeEach(() => jest.clearAllMocks());

describe('plant.service', () => {
  describe('createPlant', () => {
    it('crea una pianta senza specie con cura manuale completa', async () => {
      (prisma.plant.create as jest.Mock).mockResolvedValue(mockPlant);

      const result = await plantService.createPlant('user-1', {
        nome: 'Monstera',
        tipo: 'pianta',
        luceCura: 'alta',
        annaffiaturaCura: 'media',
        umiditaCura: 'media',
      });

      expect(result.nome).toBe('Monstera');
      expect(prisma.species.findUnique).not.toHaveBeenCalled();
    });

    it('rifiuta una pianta senza specie e senza cura manuale completa', async () => {
      await expect(
        plantService.createPlant('user-1', { nome: 'Monstera', tipo: 'pianta' })
      ).rejects.toMatchObject({ code: 'PLANT_CURA_INCOMPLETA' });
    });

    it('D16: elenca solo i campi cura mancanti nel messaggio (un campo)', async () => {
      await expect(
        plantService.createPlant('user-1', {
          nome: 'Monstera',
          tipo: 'pianta',
          annaffiaturaCura: 'media',
          umiditaCura: 'media',
        })
      ).rejects.toMatchObject({
        code: 'PLANT_CURA_INCOMPLETA',
        message: expect.stringContaining('luce'),
      });
    });

    it('D16: elenca tutti i campi mancanti nel messaggio (nessuno impostato)', async () => {
      try {
        await plantService.createPlant('user-1', { nome: 'Monstera', tipo: 'pianta' });
        throw new Error('doveva lanciare');
      } catch (err: any) {
        expect(err.message).toContain('luce');
        expect(err.message).toContain('annaffiatura');
        expect(err.message).toContain('umidità');
      }
    });

    it('D16: non elenca campi già presenti', async () => {
      try {
        await plantService.createPlant('user-1', {
          nome: 'Monstera',
          tipo: 'pianta',
          luceCura: 'alta',
        });
        throw new Error('doveva lanciare');
      } catch (err: any) {
        expect(err.message).toBe('Senza una specie di catalogo sono obbligatori: annaffiatura, umidità');
      }
    });

    it('rifiuta se la specie indicata non esiste', async () => {
      (prisma.species.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        plantService.createPlant('user-1', { nome: 'Monstera', tipo: 'pianta', speciesId: 'nope' })
      ).rejects.toMatchObject({ code: 'SPECIES_NOT_FOUND' });
    });

    it('imposta statoBouquet di default per i bouquet', async () => {
      (prisma.plant.create as jest.Mock).mockResolvedValue({});

      await plantService.createPlant('user-1', { nome: 'Rose', tipo: 'bouquet' });

      const args = (prisma.plant.create as jest.Mock).mock.calls[0][0];
      expect(args.data.statoBouquet).toBe('fresco');
    });

    it('non imposta statoBouquet per le piante', async () => {
      (prisma.plant.create as jest.Mock).mockResolvedValue({});

      await plantService.createPlant('user-1', {
        nome: 'Monstera',
        tipo: 'pianta',
        statoBouquet: 'fresco',
        luceCura: 'alta',
        annaffiaturaCura: 'media',
        umiditaCura: 'media',
      });

      const args = (prisma.plant.create as jest.Mock).mock.calls[0][0];
      expect(args.data.statoBouquet).toBeNull();
    });

    it('crea task iniziale cambio_acqua per bouquet non già in acqua', async () => {
      (prisma.plant.create as jest.Mock).mockResolvedValue({ id: 'plant-1' });
      (prisma.task.create as jest.Mock).mockResolvedValue({});

      await plantService.createPlant('user-1', { nome: 'Rose', tipo: 'bouquet', giaInAcqua: false });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tipo: 'cambio_acqua', plantId: 'plant-1' }) })
      );
    });

    it('non crea task iniziale se il bouquet è già in acqua', async () => {
      (prisma.plant.create as jest.Mock).mockResolvedValue({ id: 'plant-1' });

      await plantService.createPlant('user-1', { nome: 'Rose', tipo: 'bouquet', giaInAcqua: true });

      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('listPlants', () => {
    it('filtra per utente e stato attivo di default', async () => {
      (prisma.plant.findMany as jest.Mock).mockResolvedValue([mockPlant]);

      const result = await plantService.listPlants('user-1');

      expect(result).toHaveLength(1);
      const args = (prisma.plant.findMany as jest.Mock).mock.calls[0][0];
      expect(args.where).toEqual({ userId: 'user-1', stato: 'attivo' });
    });
  });

  describe('getPlant', () => {
    it('restituisce la pianta con specie e task pending', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(mockPlant);

      const result = await plantService.getPlant('user-1', 'plant-1');

      expect(result.id).toBe('plant-1');
    });

    it('rifiuta se la pianta non esiste o appartiene ad altro utente', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(plantService.getPlant('user-1', 'plant-x')).rejects.toMatchObject({
        code: 'PLANT_NOT_FOUND',
      });
    });
  });

  describe('updatePlant', () => {
    it('aggiorna solo i campi passati', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(mockPlant);
      (prisma.plant.update as jest.Mock).mockResolvedValue({ ...mockPlant, nome: 'Nuovo' });

      const result = await plantService.updatePlant('user-1', 'plant-1', { nome: 'Nuovo' });

      expect(result.nome).toBe('Nuovo');
      const args = (prisma.plant.update as jest.Mock).mock.calls[0][0];
      expect(args.data).toEqual({ nome: 'Nuovo' });
    });

    it('rifiuta se la pianta non è dell\'utente', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(plantService.updatePlant('user-1', 'plant-x', { nome: 'X' })).rejects.toMatchObject({
        code: 'PLANT_NOT_FOUND',
      });
    });

    it('annulla i task pending quando la pianta viene archiviata', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(mockPlant);
      (prisma.plant.update as jest.Mock).mockResolvedValue({ ...mockPlant, stato: 'archiviato' });
      (prisma.task.updateMany as jest.Mock).mockResolvedValue({});

      await plantService.updatePlant('user-1', 'plant-1', { stato: 'archiviato' });

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { plantId: 'plant-1', stato: 'pending' },
        data: { stato: 'saltato' },
      });
    });

    it('imposta statoBouquetManuale quando statoBouquet è impostato esplicitamente', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(mockPlant);
      (prisma.plant.update as jest.Mock).mockResolvedValue({});

      await plantService.updatePlant('user-1', 'plant-1', { statoBouquet: 'concluso' });

      const args = (prisma.plant.update as jest.Mock).mock.calls[0][0];
      expect(args.data.statoBouquetManuale).toBe(true);
    });

    describe('D14 — ricalcolo scadenza su cambio annaffiatura', () => {
      const taskPendingId = 'task-annaffiatura-1';

      it('ricalcola la scadenza del task pending quando annaffiaturaCura cambia', async () => {
        (prisma.plant.findFirst as jest.Mock).mockResolvedValue({
          ...mockPlant,
          annaffiaturaCura: 'poca',
        });
        (prisma.species.findUnique as jest.Mock).mockResolvedValue({ annaffiatura: 'media' });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
        (prisma.plant.update as jest.Mock).mockResolvedValue({});
        (prisma.task.findFirst as jest.Mock).mockResolvedValue({ id: taskPendingId });
        (prisma.task.update as jest.Mock).mockResolvedValue({});

        await plantService.updatePlant('user-1', 'plant-1', { annaffiaturaCura: 'frequente' });

        expect(prisma.task.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: taskPendingId } })
        );
        const scadenzaArgs = (prisma.task.update as jest.Mock).mock.calls[0][0];
        const scadenzaImpostata: Date = scadenzaArgs.data.scadenza;
        const oggi = new Date();
        // Riferimento = oggi, non il vecchio createdAt del task (spec D14).
        expect(Math.abs(scadenzaImpostata.getTime() - oggi.getTime())).toBeLessThan(5 * 24 * 60 * 60 * 1000);
      });

      it('non ricalcola se annaffiaturaCura non cambia il valore effettivo', async () => {
        (prisma.plant.findFirst as jest.Mock).mockResolvedValue({
          ...mockPlant,
          annaffiaturaCura: 'media',
        });
        (prisma.plant.update as jest.Mock).mockResolvedValue({});

        await plantService.updatePlant('user-1', 'plant-1', { annaffiaturaCura: 'media' });

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it('non ricalcola se cambia un campo non legato alla cura (es. nome)', async () => {
        (prisma.plant.findFirst as jest.Mock).mockResolvedValue({
          ...mockPlant,
          annaffiaturaCura: 'media',
        });
        (prisma.plant.update as jest.Mock).mockResolvedValue({});

        await plantService.updatePlant('user-1', 'plant-1', { nome: 'Nuovo nome' });

        expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it('ricalcola quando cambia la specie e la nuova ha annaffiatura diversa (senza override)', async () => {
        (prisma.plant.findFirst as jest.Mock).mockResolvedValue({
          ...mockPlant,
          speciesId: 'species-1',
          annaffiaturaCura: null,
        });
        // prima chiamata species.findUnique = specie vecchia (existing.speciesId),
        // assertSpeciesExists fa la sua chiamata per la specie nuova.
        (prisma.species.findUnique as jest.Mock)
          .mockResolvedValueOnce({ annaffiatura: 'poca' }) // assertSpeciesExists(nuova specie)
          .mockResolvedValueOnce({ annaffiatura: 'poca' }); // fetch specie vecchia
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
        (prisma.plant.update as jest.Mock).mockResolvedValue({});
        (prisma.task.findFirst as jest.Mock).mockResolvedValue({ id: taskPendingId });
        (prisma.task.update as jest.Mock).mockResolvedValue({});

        await plantService.updatePlant('user-1', 'plant-1', { speciesId: 'species-2' });

        expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it('non fa nulla se non esiste un task annaffiatura pending', async () => {
        (prisma.plant.findFirst as jest.Mock).mockResolvedValue({
          ...mockPlant,
          annaffiaturaCura: 'poca',
        });
        (prisma.species.findUnique as jest.Mock).mockResolvedValue({ annaffiatura: 'poca' });
        (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
        (prisma.plant.update as jest.Mock).mockResolvedValue({});
        (prisma.task.findFirst as jest.Mock).mockResolvedValue(null);

        await plantService.updatePlant('user-1', 'plant-1', { annaffiaturaCura: 'frequente' });

        expect(prisma.task.update).not.toHaveBeenCalled();
      });

      it('non ricalcola per i bouquet', async () => {
        (prisma.plant.findFirst as jest.Mock).mockResolvedValue({
          ...mockPlant,
          tipo: 'bouquet',
          speciesId: null,
          annaffiaturaCura: null,
        });
        (prisma.plant.update as jest.Mock).mockResolvedValue({});

        await plantService.updatePlant('user-1', 'plant-1', { nome: 'Rose nuove' });

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
        expect(prisma.task.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('deletePlant', () => {
    it('esegue soft delete e annulla i task pending', async () => {
      (prisma.plant.findFirst as jest.Mock).mockResolvedValue(mockPlant);
      (prisma.plant.update as jest.Mock).mockResolvedValue({});
      (prisma.task.updateMany as jest.Mock).mockResolvedValue({});

      await plantService.deletePlant('user-1', 'plant-1');

      expect(prisma.plant.update).toHaveBeenCalledWith({
        where: { id: 'plant-1' },
        data: { stato: 'eliminato' },
      });
      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { plantId: 'plant-1', stato: 'pending' },
        data: { stato: 'saltato' },
      });
    });
  });
});
