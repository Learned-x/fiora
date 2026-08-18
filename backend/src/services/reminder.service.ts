import { prisma } from '../lib/prisma';

// Mapping annaffiatura specie → intervallo base giorni tra un task e il successivo.
// Valori orientativi, tarabili in futuro senza toccare lo schema.
export const INTERVALLO_ANNAFFIATURA_GIORNI: Record<string, number> = {
  poca: 10,
  media: 5,
  frequente: 2,
};

// Fattore moltiplicativo sull'intervallo base annaffiatura, in base al clima dell'utente.
export const FATTORE_CLIMA: Record<string, number> = {
  freddo: 1.3,
  temperato: 1.0,
  appartamento: 1.0,
  mediterraneo: 0.8,
  tropicale: 0.7,
};

const GIORNI_CONCIMAZIONE = 30;
const MESE_INIZIO_CONCIMAZIONE = 2; // marzo (0-based)
const MESE_FINE_CONCIMAZIONE = 9; // ottobre (0-based)
const GIORNI_CAMBIO_ACQUA = 2;
const GIORNI_CONTROLLO_STATO = 1;

// Calcola la prossima scadenza per l'annaffiatura, applicando il fattore clima
// all'intervallo base della specie. Funzione pura, riusata dal cron e dal
// ricalcolo on-demand al cambio clima utente.
export function calcolaProssimaScadenza(
  riferimento: Date,
  annaffiatura: string,
  clima: string
): Date | null {
  const base = INTERVALLO_ANNAFFIATURA_GIORNI[annaffiatura];
  if (!base) return null;

  const fattore = FATTORE_CLIMA[clima] ?? 1.0;
  const intervallo = Math.max(1, Math.round(base * fattore));

  const scadenza = new Date(riferimento);
  scadenza.setDate(scadenza.getDate() + intervallo);
  return scadenza;
}

// Genera i task 'annaffiatura' di sorgente 'calendario' per le piante che ne hanno bisogno.
// Una pianta è idonea se: attiva, ha una fonte di annaffiatura (override manuale
// sulla pianta o specie di catalogo — l'override vince se presente, stesso ordine
// usato per le soglie sensore in plant.service.ts), e non ha già un task pending.
export async function generateWateringReminders(now: Date = new Date()) {
  const plants = await prisma.plant.findMany({
    where: {
      stato: 'attivo',
      OR: [{ speciesId: { not: null } }, { annaffiaturaCura: { not: null } }],
    },
    include: {
      species: { select: { annaffiatura: true } },
      user: { select: { clima: true } },
      tasks: {
        where: { tipo: 'annaffiatura' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let created = 0;

  for (const plant of plants) {
    const annaffiatura = plant.annaffiaturaCura ?? plant.species?.annaffiatura ?? '';
    if (!INTERVALLO_ANNAFFIATURA_GIORNI[annaffiatura]) continue;

    const ultimoTask = plant.tasks[0];

    // Task già pending: non generarne un altro.
    if (ultimoTask && ultimoTask.stato === 'pending') continue;

    const riferimento = ultimoTask ? (ultimoTask.completatoA ?? ultimoTask.createdAt) : plant.createdAt;
    const prossimaScadenza = calcolaProssimaScadenza(riferimento, annaffiatura, plant.user.clima);

    if (!prossimaScadenza || prossimaScadenza > now) continue;

    await prisma.task.create({
      data: {
        plantId: plant.id,
        userId: plant.userId,
        tipo: 'annaffiatura',
        sorgente: 'calendario',
        stato: 'pending',
        scadenza: prossimaScadenza,
      },
    });
    created++;
  }

  return { checked: plants.length, created };
}

// Genera i task 'concimazione' (ogni 30gg, solo marzo-ottobre) per piante attive con specie.
// Nessuna modulazione clima: la spec la lega esplicitamente solo all'annaffiatura.
export async function generateFertilizingReminders(now: Date = new Date()) {
  const mese = now.getMonth();
  if (mese < MESE_INIZIO_CONCIMAZIONE || mese > MESE_FINE_CONCIMAZIONE) {
    return { checked: 0, created: 0 };
  }

  const plants = await prisma.plant.findMany({
    where: {
      stato: 'attivo',
      speciesId: { not: null },
    },
    include: {
      tasks: {
        where: { tipo: 'concimazione' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let created = 0;

  for (const plant of plants) {
    const ultimoTask = plant.tasks[0];
    if (ultimoTask && ultimoTask.stato === 'pending') continue;

    const riferimento = ultimoTask ? (ultimoTask.completatoA ?? ultimoTask.createdAt) : plant.createdAt;
    const prossimaScadenza = new Date(riferimento);
    prossimaScadenza.setDate(prossimaScadenza.getDate() + GIORNI_CONCIMAZIONE);

    if (prossimaScadenza > now) continue;

    await prisma.task.create({
      data: {
        plantId: plant.id,
        userId: plant.userId,
        tipo: 'concimazione',
        sorgente: 'calendario',
        stato: 'pending',
        scadenza: prossimaScadenza,
      },
    });
    created++;
  }

  return { checked: plants.length, created };
}

// Genera task 'cambio_acqua' (2gg) e 'controllo_stato' (1gg) per i bouquet attivi
// non ancora conclusi.
export async function generateBouquetReminders(now: Date = new Date()) {
  const plants = await prisma.plant.findMany({
    where: {
      tipo: 'bouquet',
      stato: 'attivo',
      statoBouquet: { not: 'concluso' },
    },
    include: {
      tasks: {
        where: { tipo: { in: ['cambio_acqua', 'controllo_stato'] } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  let created = 0;

  for (const plant of plants) {
    const riferimentoIniziale = plant.dataRicezione ?? plant.createdAt;

    for (const [tipo, giorni] of [
      ['cambio_acqua', GIORNI_CAMBIO_ACQUA],
      ['controllo_stato', GIORNI_CONTROLLO_STATO],
    ] as const) {
      const ultimoTask = plant.tasks.find((t: { tipo: string }) => t.tipo === tipo);
      if (ultimoTask && ultimoTask.stato === 'pending') continue;

      const riferimento = ultimoTask ? (ultimoTask.completatoA ?? ultimoTask.createdAt) : riferimentoIniziale;
      const prossimaScadenza = new Date(riferimento);
      prossimaScadenza.setDate(prossimaScadenza.getDate() + giorni);

      if (prossimaScadenza > now) continue;

      await prisma.task.create({
        data: {
          plantId: plant.id,
          userId: plant.userId,
          tipo,
          sorgente: 'calendario',
          stato: 'pending',
          scadenza: prossimaScadenza,
        },
      });
      created++;
    }
  }

  return { checked: plants.length, created };
}

// Ricalcola lo statoBouquet automatico in base ai giorni trascorsi dalla ricezione,
// per le piante bouquet attive che non sono state impostate manualmente dall'utente.
export async function recalcolaStatoBouquet(now: Date = new Date()) {
  const plants = await prisma.plant.findMany({
    where: {
      tipo: 'bouquet',
      stato: 'attivo',
      statoBouquetManuale: false,
    },
  });

  let aggiornati = 0;

  for (const plant of plants) {
    const riferimento = plant.dataRicezione ?? plant.createdAt;
    const giorni = Math.floor((now.getTime() - new Date(riferimento).getTime()) / (24 * 60 * 60 * 1000));

    let nuovoStato: string;
    if (giorni <= 2) nuovoStato = 'fresco';
    else if (giorni <= 6) nuovoStato = 'in_cura';
    else if (giorni <= 10) nuovoStato = 'appassendo';
    else nuovoStato = 'concluso';

    if (plant.statoBouquet !== nuovoStato) {
      await prisma.plant.update({
        where: { id: plant.id },
        data: { statoBouquet: nuovoStato },
      });
      aggiornati++;
    }
  }

  return { checked: plants.length, aggiornati };
}

// Ricalcola le scadenze dei task 'annaffiatura' pending/calendario delle piante
// senza vaso smart dell'utente, in seguito a un cambio di clima (spec 13.1).
export async function ricalcolaScadenzeClima(userId: string, nuovoClima: string) {
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      tipo: 'annaffiatura',
      sorgente: 'calendario',
      stato: 'pending',
      plant: { vasoId: null, stato: 'attivo' },
    },
    include: {
      plant: { include: { species: { select: { annaffiatura: true } } } },
    },
  });

  let aggiornati = 0;

  for (const task of tasks) {
    const annaffiatura = task.plant.annaffiaturaCura ?? task.plant.species?.annaffiatura;
    if (!annaffiatura) continue;

    const nuovaScadenza = calcolaProssimaScadenza(task.createdAt, annaffiatura, nuovoClima);
    if (!nuovaScadenza) continue;

    await prisma.task.update({
      where: { id: task.id },
      data: { scadenza: nuovaScadenza },
    });
    aggiornati++;
  }

  return { checked: tasks.length, aggiornati };
}

// Ricalcola la scadenza del task 'annaffiatura' pending di UNA pianta, in
// seguito a un cambio di annaffiaturaCura o specie (D14, spec fiora-mev.md).
// A differenza di ricalcolaScadenzeClima il riferimento è oggi (non
// task.createdAt): il vecchio intervallo non è più valido dal momento del
// cambio, non da quando il task era stato creato.
export async function ricalcolaScadenzaAnnaffiaturaPianta(
  plantId: string,
  annaffiatura: string,
  clima: string,
  now: Date = new Date(),
  client: typeof prisma = prisma
): Promise<boolean> {
  const task = await client.task.findFirst({
    where: { plantId, tipo: 'annaffiatura', sorgente: 'calendario', stato: 'pending' },
  });
  if (!task) return false;

  const nuovaScadenza = calcolaProssimaScadenza(now, annaffiatura, clima);
  if (!nuovaScadenza) return false;

  await client.task.update({
    where: { id: task.id },
    data: { scadenza: nuovaScadenza },
  });
  return true;
}

// Aggregatore: esegue tutto il reminder engine in ordine. Il ricalcolo dello
// statoBouquet va prima della generazione task bouquet, per rispettare il
// filtro statoBouquet != 'concluso' con il valore aggiornato.
export async function runReminderEngine(now: Date = new Date()) {
  const statoBouquetAggiornati = await recalcolaStatoBouquet(now);
  const watering = await generateWateringReminders(now);
  const fertilizing = await generateFertilizingReminders(now);
  const bouquet = await generateBouquetReminders(now);

  return { watering, fertilizing, bouquet, statoBouquetAggiornati };
}
