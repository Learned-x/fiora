jest.mock('../lib/prisma');

import * as appOptionService from './app-option.service';
import { prisma } from '../lib/prisma';

beforeEach(() => jest.clearAllMocks());

describe('app-option.service listOptions', () => {
  it('restituisce tutte le opzioni attive senza filtro categoria', async () => {
    (prisma.appOption.findMany as jest.Mock).mockResolvedValue([{ categoria: 'clima', chiave: 'freddo' }]);

    const result = await appOptionService.listOptions();

    expect(result).toHaveLength(1);
    expect(prisma.appOption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attivo: true } })
    );
  });

  it('filtra per categoria quando specificata', async () => {
    (prisma.appOption.findMany as jest.Mock).mockResolvedValue([]);

    await appOptionService.listOptions('clima');

    expect(prisma.appOption.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { attivo: true, categoria: 'clima' } })
    );
  });
});
