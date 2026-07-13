jest.mock('../lib/prisma');
jest.mock('expo-server-sdk');

import {
  buildPushMessage,
  getUsersWithDueTasks,
  orarioFromHour,
  sendDailyPushReminders,
} from './notification.service';
import { prisma } from '../lib/prisma';
import { Expo } from 'expo-server-sdk';

beforeEach(() => jest.clearAllMocks());

describe('orarioFromHour', () => {
  it.each([
    [9, 'mattina_9'],
    [15, 'pomeriggio_15'],
    [19, 'sera_19'],
  ])('mappa %i su %s', (hour, orario) => {
    expect(orarioFromHour(hour)).toBe(orario);
  });

  it('ritorna null per un\'ora fuori fascia', () => {
    expect(orarioFromHour(6)).toBeNull();
  });
});

describe('buildPushMessage', () => {
  const token = 'ExponentPushToken[abc]';

  it('1 task annaffiatura → messaggio specifico con deep link alla pianta', () => {
    const msg = buildPushMessage(token, [
      { tipo: 'annaffiatura', plantId: 'p1', plantNome: 'Monstera' },
    ]);
    expect(msg).toMatchObject({
      to: token,
      title: '🌱 Annaffia Monstera',
      data: { url: '/plant/p1' },
    });
  });

  it('1 task concimazione → titolo concimazione', () => {
    const msg = buildPushMessage(token, [
      { tipo: 'concimazione', plantId: 'p2', plantNome: 'Ficus' },
    ]);
    expect(msg?.title).toBe('🌿 Concima Ficus');
  });

  it('1 task di tipo sconosciuto → titolo generico', () => {
    const msg = buildPushMessage(token, [
      { tipo: 'controllo', plantId: 'p3', plantNome: 'Aloe' },
    ]);
    expect(msg?.title).toBe('🪴 Cura Aloe');
  });

  it('più task → digest verso la tab Oggi', () => {
    const msg = buildPushMessage(token, [
      { tipo: 'annaffiatura', plantId: 'p1', plantNome: 'Monstera' },
      { tipo: 'concimazione', plantId: 'p2', plantNome: 'Ficus' },
      { tipo: 'cambio_acqua', plantId: 'p3', plantNome: 'Bouquet' },
    ]);
    expect(msg).toMatchObject({
      body: 'Hai 3 cure da fare oggi',
      data: { url: '/' },
    });
  });

  it('0 task → null', () => {
    expect(buildPushMessage(token, [])).toBeNull();
  });
});

describe('getUsersWithDueTasks', () => {
  it('filtra per orario e pushToken presente, mappa i task', async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'u1',
        pushToken: 'ExponentPushToken[a]',
        tasks: [{ tipo: 'annaffiatura', plantId: 'p1', plant: { nome: 'Monstera' } }],
      },
    ]);

    const result = await getUsersWithDueTasks('mattina_9', new Date('2026-07-13T09:00:00'));

    const where = (prisma.user.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where).toMatchObject({
      pushToken: { not: null },
      orarioReminder: 'mattina_9',
      deletedAt: null,
    });
    expect(result).toEqual([
      {
        userId: 'u1',
        pushToken: 'ExponentPushToken[a]',
        tasks: [{ tipo: 'annaffiatura', plantId: 'p1', plantNome: 'Monstera' }],
      },
    ]);
  });
});

describe('sendDailyPushReminders', () => {
  function mockUsers(users: unknown[]) {
    (prisma.user.findMany as jest.Mock).mockResolvedValue(users);
  }

  it('utente senza task → nessun invio', async () => {
    mockUsers([{ id: 'u1', pushToken: 'ExponentPushToken[a]', tasks: [] }]);

    const result = await sendDailyPushReminders('mattina_9');

    expect(result).toEqual({ utentiNotificati: 0, tokenRimossi: 0 });
    const expoInstance = new Expo();
    expect(expoInstance.sendPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('token non valido → scartato senza invio', async () => {
    mockUsers([
      {
        id: 'u1',
        pushToken: 'token-non-expo',
        tasks: [{ tipo: 'annaffiatura', plantId: 'p1', plant: { nome: 'Monstera' } }],
      },
    ]);

    const result = await sendDailyPushReminders('mattina_9');

    expect(result).toEqual({ utentiNotificati: 0, tokenRimossi: 0 });
  });

  it('ticket ok → utente contato come notificato', async () => {
    mockUsers([
      {
        id: 'u1',
        pushToken: 'ExponentPushToken[a]',
        tasks: [{ tipo: 'annaffiatura', plantId: 'p1', plant: { nome: 'Monstera' } }],
      },
    ]);
    const expoInstance = new Expo();
    (expoInstance.sendPushNotificationsAsync as jest.Mock).mockResolvedValue([{ status: 'ok' }]);

    const result = await sendDailyPushReminders('mattina_9');

    expect(result).toEqual({ utentiNotificati: 1, tokenRimossi: 0 });
    expect(expoInstance.chunkPushNotifications).toHaveBeenCalled();
  });

  it('ticket DeviceNotRegistered → azzera il pushToken dell\'utente giusto', async () => {
    mockUsers([
      {
        id: 'u1',
        pushToken: 'ExponentPushToken[a]',
        tasks: [{ tipo: 'annaffiatura', plantId: 'p1', plant: { nome: 'Monstera' } }],
      },
      {
        id: 'u2',
        pushToken: 'ExponentPushToken[b]',
        tasks: [{ tipo: 'concimazione', plantId: 'p2', plant: { nome: 'Ficus' } }],
      },
    ]);
    const expoInstance = new Expo();
    (expoInstance.sendPushNotificationsAsync as jest.Mock).mockResolvedValue([
      { status: 'ok' },
      { status: 'error', details: { error: 'DeviceNotRegistered' } },
    ]);

    const result = await sendDailyPushReminders('mattina_9');

    expect(result).toEqual({ utentiNotificati: 1, tokenRimossi: 1 });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u2' },
      data: { pushToken: null },
    });
  });
});
