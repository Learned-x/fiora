import { prisma } from '../lib/prisma';

// Mapping annaffiatura specie → intervallo giorni tra un task e il successivo.
// Valori orientativi, tarabili in futuro senza toccare lo schema.
export const INTERVALLO_ANNAFFIATURA_GIORNI: Record<string, number> = {
  poca: 10,
  media: 5,
  frequente: 2,
};

// Genera i task 'annaffiatura' di sorgente 'calendario' per le piante che ne hanno bisogno.
// Una pianta è idonea se: attiva, ha una specie collegata, e non ha già un task
// di annaffiatura pending (calendario o manuale — evita duplicati se l'utente ne ha creato uno a mano).
export async function generateWateringReminders(now: Date = new Date()) {
  const plants = await prisma.plant.findMany({
    where: {
      stato: 'attivo',
      speciesId: { not: null },
    },
    include: {
      species: { select: { annaffiatura: true } },
      tasks: {
        where: { tipo: 'annaffiatura' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  let created = 0;

  for (const plant of plants) {
    const intervallo = INTERVALLO_ANNAFFIATURA_GIORNI[plant.species?.annaffiatura ?? ''];
    if (!intervallo) continue;

    const ultimoTask = plant.tasks[0];

    // Task già pending: non generarne un altro.
    if (ultimoTask && ultimoTask.stato === 'pending') continue;

    const riferimento = ultimoTask ? (ultimoTask.completatoA ?? ultimoTask.createdAt) : plant.createdAt;
    const prossimaScadenza = new Date(riferimento);
    prossimaScadenza.setDate(prossimaScadenza.getDate() + intervallo);

    if (prossimaScadenza > now) continue;

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
