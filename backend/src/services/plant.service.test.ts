jest.mock('../lib/prisma');

import * as plantService from './plant.service';
import { prisma } from '../lib/prisma';

const mockPlant = {
  id: 'plant-1',
  userId: 'user-1',
  nome: 'Monstera',
  tipo: 'pianta',
  stato: 'attivo',
};

beforeEach(() => jest.clearAllMocks());

describe('plant.service', () => {
  describe('createPlant', () => {
    it('crea una pianta senza specie', async () => {
      (prisma.plant.create as jest.Mock).mockResolvedValue(mockPlant);

      const result = await plantService.createPlant('user-1', { nome: 'Monstera', tipo: 'pianta' });

      expect(result.nome).toBe('Monstera');
      expect(prisma.species.findUnique).not.toHaveBeenCalled();
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

      await plantService.createPlant('user-1', { nome: 'Monstera', tipo: 'pianta', statoBouquet: 'fresco' });

      const args = (prisma.plant.create as jest.Mock).mock.calls[0][0];
      expect(args.data.statoBouquet).toBeNull();
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
