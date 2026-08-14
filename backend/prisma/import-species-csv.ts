// Import una tantum del catalogo specie da CSV (dev/test) in Species.
// Esecuzione: npx ts-node-dev --transpile-only --quiet prisma/import-species-csv.ts <path-csv>
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { prisma } from '../src/lib/prisma';

interface CsvRow {
  id: string;
  nome_comune: string;
  nome_scientifico: string;
  categoria: string;
  luce: string;
  annaffiatura: string;
  umidita: string;
  temp_min: string;
  temp_max: string;
  tossicita: string;
  note_cura: string;
  soglia_umidita: string;
  fonte: string;
  stato: string;
  external_id: string;
  immagine_principale_url: string;
}

function toIntOrNull(value: string): number | null {
  return value.trim() === '' ? null : parseInt(value, 10);
}

function toStringOrNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}

async function main() {
  const csvPath = process.argv[2] ?? path.join(__dirname, '../../template_specie/species.csv');
  const raw = fs.readFileSync(csvPath, 'utf-8');
  const rows: CsvRow[] = parse(raw, { columns: true, skip_empty_lines: true });

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const existing = await prisma.species.findUnique({ where: { id: row.id } });
    if (existing) {
      console.log(`↷ ${row.nome_comune} già presente, salto`);
      skipped++;
      continue;
    }

    await prisma.species.create({
      data: {
        id: row.id,
        nomeComune: row.nome_comune,
        nomeScientifico: toStringOrNull(row.nome_scientifico),
        categoria: toStringOrNull(row.categoria),
        luce: row.luce,
        annaffiatura: row.annaffiatura,
        umidita: toStringOrNull(row.umidita),
        tempMin: toIntOrNull(row.temp_min),
        tempMax: toIntOrNull(row.temp_max),
        tossicita: row.tossicita.trim() === '' ? null : row.tossicita.trim().toLowerCase() === 'true',
        noteCura: toStringOrNull(row.note_cura),
        sogliaUmidita: toIntOrNull(row.soglia_umidita),
        fonte: row.fonte,
        stato: row.stato || 'attivo',
        externalId: toIntOrNull(row.external_id),
        immaginePrincipaleUrl: toStringOrNull(row.immagine_principale_url),
      },
    });
    console.log(`✓ ${row.nome_comune} creata`);
    created++;
  }

  console.log(`\nFatto: ${created} create, ${skipped} già presenti.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().then(() => process.exit(1));
  });
