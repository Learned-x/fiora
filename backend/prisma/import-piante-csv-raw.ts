// Import grezzo 1:1 di template_specie/piante.csv in piante_csv_raw.
// Nessuna interpretazione/mapping/traduzione — solo le colonne del CSV così come sono,
// da analizzare in un secondo momento prima di un eventuale sync verso Species.
// Esecuzione: npx ts-node-dev --transpile-only --quiet prisma/import-piante-csv-raw.ts [path-csv]
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/lib/prisma';

// Tokenizer RFC 4180 manuale (stato dentro/fuori virgolette carattere per carattere).
// csv-parse (libreria, modalità strict) si è rivelato inaffidabile su questo file
// specifico: alcune righe "spazzatura" a fine file hanno quoting malformato che lo
// manda in errore, e i flag di tolleranza fondevano erroneamente le righe successive
// in un solo record. Un tokenizer scritto a mano, tollerante per costruzione, evita
// il problema alla radice.
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const char = content[i];

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (char === '\r') {
      i += 1;
      continue;
    }
    if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toStringOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function main() {
  const csvPath = process.argv[2] ?? path.join(__dirname, '../../template_specie/piante.csv');
  const rawFile = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
  const [header, ...dataRows] = parseCsv(rawFile);

  const rows = dataRows
    .filter((values) => values.length === header.length)
    .map((values) => {
      const record: Record<string, string> = {};
      header.forEach((key, idx) => {
        record[key] = values[idx] ?? '';
      });
      return record;
    })
    .filter((row) => row['Botanical Name']?.trim());

  console.log(`CSV letto: ${dataRows.length} righe totali, ${rows.length} con nome botanico`);

  await prisma.pianteCsvRaw.deleteMany();

  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE).map((row) => ({
      plantId: toStringOrNull(row['Plant ID']),
      plantCode: toStringOrNull(row['Plant Code']),
      botanicalName: toStringOrNull(row['Botanical Name']),
      commonName: toStringOrNull(row['Common Name']),
      previousName: toStringOrNull(row['Previous Name']),
      plantType: toStringOrNull(row['Plant Type']),
      waterNeeds: toStringOrNull(row['Water Needs']),
      climateZones: toStringOrNull(row['Climate Zones']),
      lightNeeds: toStringOrNull(row['Light Needs']),
      soilType: toStringOrNull(row['Soil Type']),
      soilAdditional: toStringOrNull(row['Soil Additional']),
      maintenance: toStringOrNull(row['Maintenance']),
      abcission: toStringOrNull(row['Abcission']),
      heightRanges: toStringOrNull(row['Height Ranges']),
      spreadRanges: toStringOrNull(row['Spread Ranges']),
      flowerColour: toStringOrNull(row['Flower colour']),
      foliageColour: toStringOrNull(row['Foliage Colour']),
      perfume: toStringOrNull(row['Perfume']),
      aromatic: toStringOrNull(row['Aromatic']),
      edible: toStringOrNull(row['Edible']),
      birdAttracting: toStringOrNull(row['Bird Attracting']),
      birdAttractant: toStringOrNull(row['Bird Attractant']),
      boreWaterTolerance: toStringOrNull(row['Bore water Tolerance']),
      frostTolerance: toStringOrNull(row['Frost Tolerance']),
      greywaterTolerance: toStringOrNull(row['Greywater Tolerance']),
      native: toStringOrNull(row['Native']),
      butterflyAttracting: toStringOrNull(row['Butterfly Attracting']),
      butterflyType: toStringOrNull(row['Butterfly Type']),
      image: toStringOrNull(row['Image']),
      imageLocation: toStringOrNull(row['Image Location']),
      imageOwner: toStringOrNull(row['Image Owner']),
      herbExternalHave: toStringOrNull(row['Herb External Have']),
      herbImagesChangeTo: toStringOrNull(row['Herb Images change to']),
      notes: toStringOrNull(row['Notes']),
      whyPhotoRemoved: toStringOrNull(row['Why photo removed']),
      whyPlantRemoved: toStringOrNull(row['Why plant removed']),
      actionedBy: toStringOrNull(row['Actioned By']),
      dateActioned: toStringOrNull(row['Date Actioned']),
      status: toStringOrNull(row['Status']),
    }));

    await prisma.pianteCsvRaw.createMany({ data: batch });
    inserted += batch.length;
    console.log(`Inserite ${inserted}/${rows.length}`);
  }

  console.log(`Import completato: ${inserted} righe in piante_csv_raw`);
}

main()
  .catch((err) => {
    console.error('Import piante_csv_raw fallito:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
