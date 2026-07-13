jest.mock('../lib/prisma');
jest.mock('./reminder.service', () => ({
  ...jest.requireActual('./reminder.service'),
  ricalcolaScadenzeClima: jest.fn(),
}));

import * as userService from './user.service';
import { prisma } from '../lib/prisma';
import { ricalcolaScadenzeClima } from './reminder.service';

beforeEach(() => jest.clearAllMocks());

describe('user.service updateProfile', () => {
  it('aggiorna i campi passati senza toccare il clima', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', name: 'Nuovo' });

    await userService.updateProfile('user-1', { name: 'Nuovo' });

    expect(ricalcolaScadenzeClima).not.toHaveBeenCalled();
  });

  it('ricalcola le scadenze quando il clima cambia', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', clima: 'tropicale' });

    await userService.updateProfile('user-1', { clima: 'tropicale' });

    expect(ricalcolaScadenzeClima).toHaveBeenCalledWith('user-1', 'tropicale');
  });

  it('non ricalcola se il clima passato è uguale a quello attuale', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', clima: 'temperato' });

    await userService.updateProfile('user-1', { clima: 'temperato' });

    expect(ricalcolaScadenzeClima).not.toHaveBeenCalled();
  });

  it('rifiuta se utente non trovato', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(userService.updateProfile('ghost', { name: 'X' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
