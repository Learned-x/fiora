jest.mock('../lib/prisma');
jest.mock('../lib/redis');
jest.mock('../lib/bullmq');

import bcrypt from 'bcrypt';
import * as authService from './auth.service';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';
import { accountDeletionQueue, emailQueue } from '../lib/bullmq';

const mockUser = {
  id: 'user-1',
  email: 'test@fiora.app',
  passwordHash: '',
  deletedAt: null as Date | null,
};

describe('auth.service', () => {
  describe('register', () => {
    it('crea un nuovo utente e restituisce i token', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue({ ...mockUser });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await authService.register('test@fiora.app', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('test@fiora.app');
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('rifiuta se l\'email è già registrata', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(authService.register('test@fiora.app', 'password123')).rejects.toMatchObject({
        code: 'AUTH_EMAIL_ALREADY_EXISTS',
      });
    });
  });

  describe('login', () => {
    it('effettua il login con credenziali corrette', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await authService.login('test@fiora.app', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.user.id).toBe('user-1');
    });

    it('rifiuta con password errata', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash });

      await expect(authService.login('test@fiora.app', 'wrong')).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    });

    it('rifiuta se utente non esiste', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.login('nope@fiora.app', 'password123')).rejects.toMatchObject({
        code: 'AUTH_INVALID_CREDENTIALS',
      });
    });

    it('riesce e restituisce graceperiod se account in eliminazione', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      const deletedAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash,
        deletedAt,
      });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await authService.login('test@fiora.app', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.graceperiod).toMatchObject({ active: true, deletedAt });
      expect(result.graceperiod!.giorniRimanenti).toBeGreaterThan(0);
    });

    it('non include graceperiod se account non in eliminazione', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash });
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await authService.login('test@fiora.app', 'password123');

      expect(result.graceperiod).toBeUndefined();
    });
  });

  describe('getProfile', () => {
    it('restituisce il profilo utente', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@fiora.app',
        name: 'Test',
        clima: 'temperato',
        onboardingDone: true,
        mostraNomiScientifici: true,
        orarioReminder: 'mattina_9',
        deletedAt: null,
      });

      const profile = await authService.getProfile('user-1');

      expect(profile.email).toBe('test@fiora.app');
      expect(profile.graceperiod).toBeUndefined();
    });

    it('rifiuta se utente non trovato', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.getProfile('ghost')).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    });
  });

  describe('changePassword', () => {
    it('aggiorna la password se quella attuale è corretta', async () => {
      const passwordHash = await bcrypt.hash('vecchia123', 4);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await authService.changePassword('user-1', 'vecchia123', 'nuovaPassword123');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-1' } })
      );
    });

    it('rifiuta se la password attuale è errata', async () => {
      const passwordHash = await bcrypt.hash('vecchia123', 4);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash });

      await expect(
        authService.changePassword('user-1', 'sbagliata', 'nuovaPassword123')
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('ruota il refresh token valido', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        token: 'old-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await authService.refresh('old-token');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).not.toBe('old-token');
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { token: 'old-token' } });
    });

    it('rifiuta token scaduto', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        token: 'expired-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(authService.refresh('expired-token')).rejects.toMatchObject({
        code: 'AUTH_TOKEN_INVALID',
      });
    });

    it('rifiuta token inesistente', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(authService.refresh('ghost-token')).rejects.toMatchObject({
        code: 'AUTH_TOKEN_INVALID',
      });
    });
  });

  describe('logout', () => {
    it('elimina il refresh token', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      await authService.logout('some-token');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { token: 'some-token' } });
    });
  });

  describe('requestAccountDeletion', () => {
    it('imposta deletedAt, invalida token, schedula il job e accoda email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      const result = await authService.requestAccountDeletion('user-1');

      expect(result.graceUntil).toBeInstanceOf(Date);
      expect(redis.setex).toHaveBeenCalledWith('blacklist:user-1', 30 * 24 * 60 * 60, '1');
      expect(accountDeletionQueue.add).toHaveBeenCalledWith(
        'delete-account',
        { userId: 'user-1' },
        expect.objectContaining({ jobId: 'delete-account-user-1' })
      );
      expect(emailQueue.add).toHaveBeenCalledWith(
        'account-deletion-requested',
        expect.objectContaining({ to: mockUser.email })
      );
    });

    it('non accoda email se utente non ha indirizzo', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, email: null });
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      await authService.requestAccountDeletion('user-1');

      expect(emailQueue.add).not.toHaveBeenCalledWith('account-deletion-requested', expect.anything());
    });
  });

  describe('requestEmailChange', () => {
    it('salva pendingEmail e accoda email di verifica e notifica', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUser, passwordHash }) // utente autenticato
        .mockResolvedValueOnce(null); // nuova email libera
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await authService.requestEmailChange('user-1', 'nuova@fiora.app', 'password123');

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({ pendingEmail: 'nuova@fiora.app' }),
        })
      );
      expect(emailQueue.add).toHaveBeenCalledWith(
        'email-change-verify',
        expect.objectContaining({ to: 'nuova@fiora.app' })
      );
      expect(emailQueue.add).toHaveBeenCalledWith(
        'email-change-notice',
        expect.objectContaining({ to: mockUser.email })
      );
    });

    it('rifiuta se la password attuale è errata', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...mockUser, passwordHash });

      await expect(
        authService.requestEmailChange('user-1', 'nuova@fiora.app', 'sbagliata')
      ).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('rifiuta se la nuova email è già registrata', async () => {
      const passwordHash = await bcrypt.hash('password123', 4);
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce({ ...mockUser, passwordHash })
        .mockResolvedValueOnce({ id: 'altro-utente' });

      await expect(
        authService.requestEmailChange('user-1', 'nuova@fiora.app', 'password123')
      ).rejects.toMatchObject({ code: 'AUTH_EMAIL_ALREADY_EXISTS' });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmailChange', () => {
    it('applica il nuovo indirizzo se il token è valido', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        id: 'user-1',
        pendingEmail: 'nuova@fiora.app',
        pendingEmailExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // email non presa da altri
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await authService.verifyEmailChange('token-valido');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          email: 'nuova@fiora.app',
          pendingEmail: null,
          pendingEmailTokenHash: null,
          pendingEmailExpiresAt: null,
        },
      });
    });

    it('rifiuta token scaduto o inesistente', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(authService.verifyEmailChange('token-ghost')).rejects.toMatchObject({
        code: 'AUTH_TOKEN_INVALID',
      });
    });
  });

  describe('cancelAccountDeletion', () => {
    it('rimuove deletedAt, blacklist e job schedulato', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({});
      (accountDeletionQueue.getJob as jest.Mock).mockResolvedValue({ remove: jest.fn() });

      await authService.cancelAccountDeletion('user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: null },
      });
      expect(redis.del).toHaveBeenCalledWith('blacklist:user-1');
      expect(accountDeletionQueue.getJob).toHaveBeenCalledWith('delete-account-user-1');
    });
  });
});
