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
  cambio_acqua: 'Cambia acqua',
  taglio_steli: 'Taglia steli',
  controllo_stato: 'Controlla',
  rotazione: 'Ruota',
  pulizia_foglie: 'Pulisci foglie',
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

const UMIDITA_CATEGORIA_LABELS: Record<string, string> = {
  bassa: 'Bassa',
  media: 'Media',
  alta: 'Alta, serve nebulizzazione',
};

export function luceLabel(luce: string | undefined): string {
  return LUCE_LABELS[luce ?? ''] ?? '—';
}

export function annaffiaturaLabel(annaffiatura: string | undefined): string {
  return ANNAFFIATURA_LABELS[annaffiatura ?? ''] ?? '—';
}

export function umiditaCategoriaLabel(umidita: string | null | undefined): string {
  return UMIDITA_CATEGORIA_LABELS[umidita ?? ''] ?? '—';
}

// Species.umidita è una stringa generica lato backend (mai vincolata a enum a
// livello DB), a differenza di Plant.umiditaCura che lo è — normalizza il
// valore letto dal catalogo prima di usarlo come default di un override tipizzato.
export function normalizzaUmiditaCategoria(v: string | null | undefined): 'bassa' | 'media' | 'alta' | null {
  return v === 'bassa' || v === 'media' || v === 'alta' ? v : null;
}

// Etichette brevi per i chip di selezione (form aggiungi/modifica pianta) —
// diverse da quelle sopra, pensate per una card informativa, non per un chip stretto.
export const LUCE_OPZIONI: { value: 'bassa' | 'media' | 'alta'; label: string }[] = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

export const ANNAFFIATURA_OPZIONI: { value: 'poca' | 'media' | 'frequente'; label: string }[] = [
  { value: 'poca', label: 'Poca' },
  { value: 'media', label: 'Media' },
  { value: 'frequente', label: 'Frequente' },
];

export const UMIDITA_OPZIONI: { value: 'bassa' | 'media' | 'alta'; label: string }[] = [
  { value: 'bassa', label: 'Bassa' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
];

// Valore effettivo con fallback pianta → specie, stesso ordine delle soglie sensore.
export function curaEffettiva<K extends string>(
  overridePianta: K | null | undefined,
  daSpecie: K | null | undefined
): K | null {
  return overridePianta ?? daSpecie ?? null;
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

export type SensorStatus = 'ok' | 'warning';

// Default hardcoded usati quando né la pianta né la specie hanno una soglia:
// stessi valori già in uso prima dell'introduzione delle soglie per-pianta.
const DEFAULT_UMIDITA_MIN = 30;
const DEFAULT_UMIDITA_MAX = 70;
const DEFAULT_LUCE_MIN = 200;

// Soglia effettiva con fallback a cascata pianta → specie → default hardcoded.
// Stesso ordine ovunque: l'override esplicito dell'utente vince sempre.
function sogliaEffettiva(
  pianta: number | null | undefined,
  specie: number | null | undefined,
  fallback: number | null
): number | null {
  if (pianta != null) return pianta;
  if (specie != null) return specie;
  return fallback;
}

export interface SogliaCoppia {
  min: number | null | undefined;
  max: number | null | undefined;
}

export function umiditaStatus(umidita: number, piantaSoglia: SogliaCoppia, specieSoglia: number | null | undefined): SensorStatus {
  const min = sogliaEffettiva(piantaSoglia.min, specieSoglia, DEFAULT_UMIDITA_MIN);
  const max = sogliaEffettiva(piantaSoglia.max, null, DEFAULT_UMIDITA_MAX);
  if (min !== null && umidita < min) return 'warning';
  if (max !== null && umidita > max) return 'warning';
  return 'ok';
}

export function umiditaLabel(umidita: number, piantaSoglia: SogliaCoppia, specieSoglia: number | null | undefined): string {
  const min = sogliaEffettiva(piantaSoglia.min, specieSoglia, DEFAULT_UMIDITA_MIN);
  const max = sogliaEffettiva(piantaSoglia.max, null, DEFAULT_UMIDITA_MAX);
  if (min !== null && umidita < min) return 'Asciutto';
  if (max !== null && umidita > max) return 'Saturo';
  return 'Umido';
}

export function luceSensoreStatus(lux: number, piantaSoglia: SogliaCoppia): SensorStatus {
  const min = sogliaEffettiva(piantaSoglia.min, null, DEFAULT_LUCE_MIN);
  const max = sogliaEffettiva(piantaSoglia.max, null, null);
  if (min !== null && lux < min) return 'warning';
  if (max !== null && lux > max) return 'warning';
  return 'ok';
}

export function luceSensoreLabel(lux: number, piantaSoglia: SogliaCoppia): string {
  const min = sogliaEffettiva(piantaSoglia.min, null, DEFAULT_LUCE_MIN);
  const max = sogliaEffettiva(piantaSoglia.max, null, null);
  if (min !== null && lux < min) return 'Scarsa';
  if (max !== null && lux > max) return 'Eccessiva';
  return 'Sufficiente';
}

export function temperaturaStatus(temp: number, piantaSoglia: SogliaCoppia, specieMin: number | null, specieMax: number | null): SensorStatus {
  const min = sogliaEffettiva(piantaSoglia.min, specieMin, null);
  const max = sogliaEffettiva(piantaSoglia.max, specieMax, null);
  if (min !== null && temp < min) return 'warning';
  if (max !== null && temp > max) return 'warning';
  return 'ok';
}

export function temperaturaLabel(temp: number, piantaSoglia: SogliaCoppia, specieMin: number | null, specieMax: number | null): string {
  const min = sogliaEffettiva(piantaSoglia.min, specieMin, null);
  const max = sogliaEffettiva(piantaSoglia.max, specieMax, null);
  if (min !== null && temp < min) return 'Bassa';
  if (max !== null && temp > max) return 'Alta';
  return 'Ottimale';
}
