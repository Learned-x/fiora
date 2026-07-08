import type { Plant, TaskTipo } from '../types/models';

const CATEGORY_EMOJI: Record<string, string> = {
  tropicale: '🌿',
  interno: '🪴',
  succulenta: '🌵',
  aromatica: '🌱',
  altro: '🌼',
};

export function plantEmoji(plant: Pick<Plant, 'tipo' | 'species'>): string {
  if (plant.tipo === 'bouquet') return '💐';
  return CATEGORY_EMOJI[plant.species?.categoria ?? ''] ?? '🪴';
}

export const TASK_LABELS: Record<TaskTipo, string> = {
  annaffiatura: 'Annaffia',
  concimazione: 'Concima',
  nebulizzazione: 'Nebulizza',
  potatura: 'Pota',
  rinvaso: 'Rinvasa',
  controllo: 'Controlla',
};

const LUCE_LABELS: Record<string, string> = {
  bassa: 'Bassa, tollera ombra',
  media: 'Media, evita sole diretto',
  alta: 'Alta, luce abbondante',
};

const ANNAFFIATURA_LABELS: Record<string, string> = {
  poca: 'Poca, lascia asciugare',
  media: 'Media, regolare',
  frequente: 'Frequente, terreno umido',
};

export function luceLabel(luce: string | undefined): string {
  return LUCE_LABELS[luce ?? ''] ?? '—';
}

export function annaffiaturaLabel(annaffiatura: string | undefined): string {
  return ANNAFFIATURA_LABELS[annaffiatura ?? ''] ?? '—';
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(today)) / 86400000);

  if (diffDays < 0) return diffDays === -1 ? 'ieri' : `${-diffDays} giorni fa`;
  if (diffDays === 0) return 'oggi';
  if (diffDays === 1) return 'domani';
  return `tra ${diffDays} giorni`;
}

export function formatTodayLong(): string {
  const formatted = new Date().toLocaleDateString('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}
