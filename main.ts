// ROADWARD — entrypoint for the make.fun best-game-01 round 3 entry.
// Builds dossier.json from this directory's game/ and screenshots/ using
// the kit's buildDossier, then writes it to MAKEFUN_OUTPUT_DIR (or here).
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The dossier is the whole submission: the scorer rebuilds it from the
// same game/ and screenshots/ and expects the same bytes.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const entryDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || entryDir;
mkdirSync(outDir, { recursive: true });

const dossier = buildDossier(entryDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

const outPath = join(outDir, 'dossier.json');
writeFileSync(outPath, dossier);
const back = readFileSync(outPath);
if (!back.equals(dossier)) throw new Error('dossier round-trip mismatch');
console.log('ROADWARD dossier written:', outPath, dossier.length + ' bytes');
console.log('round-trip check: OK');
