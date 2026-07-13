// Seed catalogo specie curato (minimo per sviluppo).
// Esecuzione: npm run seed
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

const curatedSpecies = [
  {
    nomeComune: 'Monstera deliciosa',
    nomeScientifico: 'Monstera deliciosa',
    categoria: 'tropicale',
    luce: 'media',
    annaffiatura: 'media',
    umidita: 'alta',
    tempMin: 15,
    tempMax: 30,
    tossicita: true,
    noteCura: 'Annaffiare quando i primi 3 cm di terreno sono asciutti. Ama luce indiretta brillante.',
    sogliaUmidita: 40,
    fonte: 'curato',
  },
  {
    nomeComune: 'Pothos',
    nomeScientifico: 'Epipremnum aureum',
    categoria: 'interno',
    luce: 'bassa',
    annaffiatura: 'poca',
    umidita: 'media',
    tempMin: 12,
    tempMax: 30,
    tossicita: true,
    noteCura: 'Molto resistente, tollera scarsa luce. Lasciare asciugare il terreno tra le annaffiature.',
    sogliaUmidita: 30,
    fonte: 'curato',
  },
  {
    nomeComune: 'Sansevieria',
    nomeScientifico: 'Dracaena trifasciata',
    categoria: 'succulenta',
    luce: 'bassa',
    annaffiatura: 'poca',
    umidita: 'bassa',
    tempMin: 10,
    tempMax: 35,
    tossicita: true,
    noteCura: 'Quasi indistruttibile. Annaffiare poco, il ristagno è il nemico principale.',
    sogliaUmidita: 20,
    fonte: 'curato',
  },
  {
    nomeComune: 'Basilico',
    nomeScientifico: 'Ocimum basilicum',
    categoria: 'aromatica',
    luce: 'alta',
    annaffiatura: 'frequente',
    umidita: 'media',
    tempMin: 15,
    tempMax: 30,
    tossicita: false,
    noteCura: 'Terreno sempre leggermente umido. Almeno 6 ore di sole al giorno.',
    sogliaUmidita: 55,
    fonte: 'curato',
  },
  {
    nomeComune: 'Ficus lyrata',
    nomeScientifico: 'Ficus lyrata',
    categoria: 'interno',
    luce: 'alta',
    annaffiatura: 'media',
    umidita: 'media',
    tempMin: 15,
    tempMax: 30,
    tossicita: true,
    noteCura: 'Non spostarlo spesso: odia i cambiamenti. Luce brillante indiretta.',
    sogliaUmidita: 40,
    fonte: 'curato',
  },
  {
    nomeComune: 'Orchidea Phalaenopsis',
    nomeScientifico: 'Phalaenopsis',
    categoria: 'tropicale',
    luce: 'media',
    annaffiatura: 'poca',
    umidita: 'alta',
    tempMin: 16,
    tempMax: 28,
    tossicita: false,
    noteCura: 'Annaffiare per immersione una volta a settimana. Mai acqua stagnante nel vaso.',
    sogliaUmidita: 35,
    fonte: 'curato',
  },
  {
    nomeComune: 'Ficus benjamina',
    nomeScientifico: 'Ficus benjamina',
    categoria: 'interno',
    luce: 'media',
    annaffiatura: 'media',
    umidita: 'media',
    tempMin: 15,
    tempMax: 28,
    tossicita: true,
    noteCura: 'Sensibile alle correnti d\'aria e agli sbalzi di temperatura. Annaffiare quando il terreno è asciutto in superficie.',
    sogliaUmidita: 35,
    fonte: 'curato',
  },
  {
    nomeComune: 'Aloe vera',
    nomeScientifico: 'Aloe vera',
    categoria: 'succulenta',
    luce: 'alta',
    annaffiatura: 'poca',
    umidita: 'bassa',
    tempMin: 10,
    tempMax: 35,
    tossicita: true,
    noteCura: 'Terreno ben drenante, lasciare asciugare completamente tra un\'annaffiatura e l\'altra.',
    sogliaUmidita: 20,
    fonte: 'curato',
  },
  {
    nomeComune: 'Calathea',
    nomeScientifico: 'Calathea orbifolia',
    categoria: 'tropicale',
    luce: 'bassa',
    annaffiatura: 'media',
    umidita: 'alta',
    tempMin: 18,
    tempMax: 28,
    tossicita: false,
    noteCura: 'Ama umidità alta, evitare acqua calcarea. Nessuna luce diretta.',
    sogliaUmidita: 50,
    fonte: 'curato',
  },
  {
    nomeComune: 'Zamioculcas',
    nomeScientifico: 'Zamioculcas zamiifolia',
    categoria: 'interno',
    luce: 'bassa',
    annaffiatura: 'poca',
    umidita: 'bassa',
    tempMin: 12,
    tempMax: 30,
    tossicita: true,
    noteCura: 'Molto resistente alla siccità, tollera scarsa luce. Evitare ristagni idrici.',
    sogliaUmidita: 20,
    fonte: 'curato',
  },
  {
    nomeComune: 'Edera',
    nomeScientifico: 'Hedera helix',
    categoria: 'interno',
    luce: 'media',
    annaffiatura: 'media',
    umidita: 'media',
    tempMin: 10,
    tempMax: 25,
    tossicita: true,
    noteCura: 'Mantenere il terreno leggermente umido, evitare l\'aria troppo secca.',
    sogliaUmidita: 40,
    fonte: 'curato',
  },
  {
    nomeComune: 'Lavanda',
    nomeScientifico: 'Lavandula angustifolia',
    categoria: 'aromatica',
    luce: 'alta',
    annaffiatura: 'poca',
    umidita: 'bassa',
    tempMin: 5,
    tempMax: 30,
    tossicita: false,
    noteCura: 'Pieno sole, terreno ben drenante. Resistente alla siccità una volta radicata.',
    sogliaUmidita: 25,
    fonte: 'curato',
  },
];

interface AppOptionSeed {
  categoria: string;
  chiave: string;
  etichetta: string;
  ordine: number;
}

const appOptions: AppOptionSeed[] = [
  { categoria: 'clima', chiave: 'freddo', etichetta: 'Freddo', ordine: 1 },
  { categoria: 'clima', chiave: 'temperato', etichetta: 'Temperato', ordine: 2 },
  { categoria: 'clima', chiave: 'appartamento', etichetta: 'Appartamento riscaldato', ordine: 3 },
  { categoria: 'clima', chiave: 'mediterraneo', etichetta: 'Mediterraneo', ordine: 4 },
  { categoria: 'clima', chiave: 'tropicale', etichetta: 'Tropicale', ordine: 5 },

  { categoria: 'posizione_casa', chiave: 'salotto', etichetta: 'Salotto', ordine: 1 },
  { categoria: 'posizione_casa', chiave: 'camera', etichetta: 'Camera da letto', ordine: 2 },
  { categoria: 'posizione_casa', chiave: 'cucina', etichetta: 'Cucina', ordine: 3 },
  { categoria: 'posizione_casa', chiave: 'bagno', etichetta: 'Bagno', ordine: 4 },
  { categoria: 'posizione_casa', chiave: 'balcone', etichetta: 'Balcone', ordine: 5 },
  { categoria: 'posizione_casa', chiave: 'terrazzo', etichetta: 'Terrazzo', ordine: 6 },
  { categoria: 'posizione_casa', chiave: 'giardino', etichetta: 'Giardino', ordine: 7 },

  { categoria: 'categoria_specie', chiave: 'interno', etichetta: 'Da interno', ordine: 1 },
  { categoria: 'categoria_specie', chiave: 'succulenta', etichetta: 'Succulenta', ordine: 2 },
  { categoria: 'categoria_specie', chiave: 'tropicale', etichetta: 'Tropicale', ordine: 3 },
  { categoria: 'categoria_specie', chiave: 'aromatica', etichetta: 'Aromatica', ordine: 4 },
  { categoria: 'categoria_specie', chiave: 'altro', etichetta: 'Altro', ordine: 5 },

  { categoria: 'luce', chiave: 'bassa', etichetta: 'Bassa', ordine: 1 },
  { categoria: 'luce', chiave: 'media', etichetta: 'Media', ordine: 2 },
  { categoria: 'luce', chiave: 'alta', etichetta: 'Alta', ordine: 3 },

  { categoria: 'annaffiatura', chiave: 'poca', etichetta: 'Poca', ordine: 1 },
  { categoria: 'annaffiatura', chiave: 'media', etichetta: 'Media', ordine: 2 },
  { categoria: 'annaffiatura', chiave: 'frequente', etichetta: 'Frequente', ordine: 3 },

  { categoria: 'umidita', chiave: 'bassa', etichetta: 'Bassa', ordine: 1 },
  { categoria: 'umidita', chiave: 'media', etichetta: 'Media', ordine: 2 },
  { categoria: 'umidita', chiave: 'alta', etichetta: 'Alta', ordine: 3 },

  { categoria: 'tipo_task', chiave: 'annaffiatura', etichetta: 'Annaffiatura', ordine: 1 },
  { categoria: 'tipo_task', chiave: 'concimazione', etichetta: 'Concimazione', ordine: 2 },
  { categoria: 'tipo_task', chiave: 'nebulizzazione', etichetta: 'Nebulizzazione', ordine: 3 },
  { categoria: 'tipo_task', chiave: 'potatura', etichetta: 'Potatura', ordine: 4 },
  { categoria: 'tipo_task', chiave: 'rinvaso', etichetta: 'Rinvaso', ordine: 5 },
  { categoria: 'tipo_task', chiave: 'cambio_acqua', etichetta: 'Cambio acqua', ordine: 6 },
  { categoria: 'tipo_task', chiave: 'taglio_steli', etichetta: 'Taglio steli', ordine: 7 },
  { categoria: 'tipo_task', chiave: 'controllo_stato', etichetta: 'Controllo stato', ordine: 8 },
  { categoria: 'tipo_task', chiave: 'rotazione', etichetta: 'Rotazione', ordine: 9 },
  { categoria: 'tipo_task', chiave: 'pulizia_foglie', etichetta: 'Pulizia foglie', ordine: 10 },

  { categoria: 'orario_reminder', chiave: 'mattina_9', etichetta: 'Mattina (9:00)', ordine: 1 },
  { categoria: 'orario_reminder', chiave: 'pomeriggio_15', etichetta: 'Pomeriggio (15:00)', ordine: 2 },
  { categoria: 'orario_reminder', chiave: 'sera_19', etichetta: 'Sera (19:00)', ordine: 3 },
];

async function seedAppOptions() {
  for (const option of appOptions) {
    await prisma.appOption.upsert({
      where: {
        uq_app_options_categoria_chiave: { categoria: option.categoria, chiave: option.chiave },
      },
      update: { etichetta: option.etichetta, ordine: option.ordine },
      create: option,
    });
  }
  console.log(`✓ ${appOptions.length} app_options seedate`);
}

async function main() {
  for (const species of curatedSpecies) {
    const existing = await prisma.species.findFirst({
      where: { nomeScientifico: species.nomeScientifico, fonte: 'curato' },
    });
    if (existing) {
      console.log(`↷ ${species.nomeComune} già presente, salto`);
      continue;
    }
    await prisma.species.create({ data: species });
    console.log(`✓ ${species.nomeComune} creata`);
  }

  await seedAppOptions();
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
