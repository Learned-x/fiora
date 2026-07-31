import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const expo = new Expo();
const log = logger.child({ module: 'notification.service' });

// Mapping orarioReminder utente → ora di invio (timezone server).
export const ORARIO_TO_HOUR: Record<string, number> = {
  mattina_9: 9,
  pomeriggio_15: 15,
  sera_19: 19,
};

// Ora → chiave orarioReminder; null se l'ora non corrisponde a nessuna fascia.
export function orarioFromHour(hour: number): string | null {
  const entry = Object.entries(ORARIO_TO_HOUR).find(([, h]) => h === hour);
  return entry ? entry[0] : null;
}

// Titolo della notifica per tipo task quando c'è un solo task in scadenza.
const TITOLO_PER_TIPO: Record<string, string> = {
  annaffiatura: '🌱 Annaffia',
  concimazione: '🌿 Concima',
  nebulizzazione: '💧 Nebulizza',
  cambio_acqua: '💐 Cambia l’acqua a',
  taglio_steli: '💐 Taglia gli steli di',
  controllo_stato: '👀 Controlla',
  rotazione: '🔄 Ruota',
  pulizia_foglie: '🍃 Pulisci le foglie di',
};

export interface DueTask {
  tipo: string;
  plantId: string;
  plantNome: string;
}

export interface PushMessagePayload {
  to: string;
  title: string;
  body: string;
  data: { url: string };
}

// Costruisce il messaggio push per un utente: 1 task → messaggio specifico con
// deep link alla pianta; N task → digest verso la tab Oggi. null se nessun task.
export function buildPushMessage(pushToken: string, tasks: DueTask[]): PushMessagePayload | null {
  if (tasks.length === 0) return null;

  if (tasks.length === 1) {
    const task = tasks[0];
    const titolo = TITOLO_PER_TIPO[task.tipo] ?? '🪴 Cura';
    return {
      to: pushToken,
      title: `${titolo} ${task.plantNome}`,
      body: 'Hai una cura in programma per oggi',
      data: { url: `/plant/${task.plantId}` },
    };
  }

  return {
    to: pushToken,
    title: 'Fiora',
    body: `Hai ${tasks.length} cure da fare oggi`,
    data: { url: '/' },
  };
}

export interface UserWithDueTasks {
  userId: string;
  pushToken: string;
  tasks: DueTask[];
}

// Utenti con push attive (pushToken presente) e orarioReminder nella fascia data,
// con i loro task pending in scadenza entro fine giornata.
export async function getUsersWithDueTasks(
  orario: string,
  now: Date = new Date()
): Promise<UserWithDueTasks[]> {
  const fineGiornata = new Date(now);
  fineGiornata.setHours(23, 59, 59, 999);

  const users = await prisma.user.findMany({
    where: {
      pushToken: { not: null },
      orarioReminder: orario,
      deletedAt: null,
    },
    select: {
      id: true,
      pushToken: true,
      tasks: {
        where: { stato: 'pending', scadenza: { lte: fineGiornata } },
        select: {
          tipo: true,
          plantId: true,
          plant: { select: { nome: true } },
        },
      },
    },
  });

  return users
    .filter((u: { pushToken: string | null }) => u.pushToken !== null)
    .map((u: { id: string; pushToken: string | null; tasks: Array<{ tipo: string; plantId: string; plant: { nome: string } }> }) => ({
      userId: u.id,
      pushToken: u.pushToken as string,
      tasks: u.tasks.map((t) => ({ tipo: t.tipo, plantId: t.plantId, plantNome: t.plant.nome })),
    }));
}

// Invia i promemoria push della fascia oraria data. Gestione errori minimale:
// ticket con errore DeviceNotRegistered → azzera il pushToken dell'utente.
// Nessun polling delle receipts (post-MVP).
export async function sendDailyPushReminders(orario: string, now: Date = new Date()) {
  const users = await getUsersWithDueTasks(orario, now);

  const messages: ExpoPushMessage[] = [];
  const userIdPerMessage: string[] = [];

  for (const user of users) {
    if (!Expo.isExpoPushToken(user.pushToken)) continue;
    const message = buildPushMessage(user.pushToken, user.tasks);
    if (!message) continue;
    messages.push({ ...message, sound: 'default', priority: 'normal' });
    userIdPerMessage.push(user.userId);
  }

  let utentiNotificati = 0;
  let tokenRimossi = 0;

  if (messages.length === 0) {
    return { utentiNotificati, tokenRimossi };
  }

  const chunks = expo.chunkPushNotifications(messages);
  let indice = 0;
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        if (ticket.status === 'ok') {
          utentiNotificati++;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          const userId = userIdPerMessage[indice + i];
          await prisma.user.update({ where: { id: userId }, data: { pushToken: null } });
          tokenRimossi++;
        }
      }
    } catch (err) {
      log.error({ err }, 'Invio chunk push fallito');
    }
    indice += chunk.length;
  }

  return { utentiNotificati, tokenRimossi };
}
