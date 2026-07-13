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

  it('aggiorna onboardingDone', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', onboardingDone: true });

    await userService.updateProfile('user-1', { onboardingDone: true });

    const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(args.data.onboardingDone).toBe(true);
  });

  it('aggiorna pushToken con una stringa', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', pushToken: 'ExponentPushToken[abc]' });

    await userService.updateProfile('user-1', { pushToken: 'ExponentPushToken[abc]' });

    const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(args.data.pushToken).toBe('ExponentPushToken[abc]');
  });

  it('azzera pushToken con null esplicito', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ clima: 'temperato' });
    (prisma.user.update as jest.Mock).mockResolvedValue({ id: 'user-1', pushToken: null });

    await userService.updateProfile('user-1', { pushToken: null });

    const args = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(args.data.pushToken).toBeNull();
  });

  it('rifiuta se utente non trovato', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(userService.updateProfile('ghost', { name: 'X' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    });
  });
});
