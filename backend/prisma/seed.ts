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
];

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
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
