jest.mock('../lib/prisma');

import * as speciesService from './species.service';
import { prisma } from '../lib/prisma';

const USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';

beforeEach(() => jest.clearAllMocks());

describe('species.service listSpecies', () => {
  it('include le specie curate e le proposte dell\'utente corrente', async () => {
    (prisma.species.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.species.count as jest.Mock).mockResolvedValue(0);

    await speciesService.listSpecies(USER_ID, { search: 'monstera' });

    const args = (prisma.species.findMany as jest.Mock).mock.calls[0][0];
    expect(args.where.OR).toEqual([{ fonte: { not: 'utente' } }, { propostoDao: USER_ID }]);
  });
});

describe('species.service proposeSpecies', () => {
  it('rifiuta se manca un campo obbligatorio', async () => {
    await expect(
      speciesService.proposeSpecies(USER_ID, {
        nomeComune: 'Pianta X',
        luce: 'media',
        annaffiatura: 'media',
        umidita: '' as any,
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('crea la specie privata quando non c\'è match nel catalogo curato', async () => {
    (prisma.species.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.species.create as jest.Mock).mockResolvedValue({
      id: 'species-nuova',
      nomeComune: 'Pianta rara del vicino',
      fonte: 'utente',
      propostoDao: USER_ID,
    });

    const result = await speciesService.proposeSpecies(USER_ID, {
      nomeComune: 'Pianta rara del vicino',
      luce: 'alta',
      annaffiatura: 'poca',
      umidita: 'bassa',
    });

    expect(result.creata).toBe(true);
    expect(prisma.species.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fonte: 'utente', stato: 'attivo', propostoDao: USER_ID }),
      })
    );
  });

  it('non crea e suggerisce il match quando esiste già nel catalogo curato', async () => {
    (prisma.species.findFirst as jest.Mock).mockResolvedValue({
      id: 'species-curata',
      nomeComune: 'Monstera deliciosa',
      fonte: 'curato',
    });

    const result = await speciesService.proposeSpecies(USER_ID, {
      nomeComune: 'Monstera deliciosa',
      luce: 'media',
      annaffiatura: 'media',
      umidita: 'media',
    });

    expect(result.creata).toBe(false);
    expect(result.suggerimento).toMatchObject({ fonte: 'curato' });
    expect(prisma.species.create).not.toHaveBeenCalled();
  });

  it('cerca il match solo tra le specie fonte=curato, mai tra quelle di altri utenti', async () => {
    (prisma.species.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.species.create as jest.Mock).mockResolvedValue({});

    await speciesService.proposeSpecies(USER_ID, {
      nomeComune: 'Pianta X',
      luce: 'media',
      annaffiatura: 'media',
      umidita: 'media',
    });

    expect(prisma.species.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ fonte: 'curato' }) })
    );
  });

  it('con forzaCrea:true crea comunque anche se esiste un match', async () => {
    (prisma.species.create as jest.Mock).mockResolvedValue({
      id: 'species-nuova',
      nomeComune: 'Monstera deliciosa',
      fonte: 'utente',
    });

    const result = await speciesService.proposeSpecies(USER_ID, {
      nomeComune: 'Monstera deliciosa',
      luce: 'media',
      annaffiatura: 'media',
      umidita: 'media',
      forzaCrea: true,
    });

    expect(result.creata).toBe(true);
    expect(prisma.species.findFirst).not.toHaveBeenCalled();
    expect(prisma.species.create).toHaveBeenCalled();
  });

  it('la specie creata da un utente è privata (propostoDao=quell\'utente, non altri)', async () => {
    (prisma.species.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.species.create as jest.Mock).mockResolvedValue({});

    await speciesService.proposeSpecies(OTHER_USER_ID, {
      nomeComune: 'Pianta Y',
      luce: 'bassa',
      annaffiatura: 'frequente',
      umidita: 'alta',
    });

    const args = (prisma.species.create as jest.Mock).mock.calls[0][0];
    expect(args.data.propostoDao).toBe(OTHER_USER_ID);
  });
});
