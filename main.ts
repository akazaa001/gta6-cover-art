// Hands in the Sunset Cover Maker: copies this repository's app/ and screenshots/ into the output
// directory and writes dossier.json there, the summary the judge reads, built with the vendored
// make.fun library. Node 22, standard library only, no network, no install step.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader MAKEFUN_OUTPUT_DIR stands in for /output; without it the program writes to
// /output. The run is deterministic: the same repository writes the same bytes every time, because
// the copy walks each directory in sorted order and the dossier is built from file contents alone.

import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

/** The caps the scorer grades against (this bounty's gate.json): only text_max_bytes shapes the bytes. */
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

/** Copies a file tree into `to`, walking each directory in sorted order so the copy is repeatable. */
function copyTree(from, to) {
  mkdirSync(to, { recursive: true });
  const entries = readdirSync(from).sort();
  for (const name of entries) {
    const source = join(from, name);
    const target = join(to, name);
    if (statSync(source).isDirectory()) copyTree(source, target);
    else copyFileSync(source, target);
  }
}

/** Removes a previous output tree, if one is there, so a rerun cannot keep stale files. */
function clearTree(path) {
  rmSync(path, { recursive: true, force: true });
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

clearTree(join(out, 'app'));
clearTree(join(out, 'screenshots'));
copyTree(join(here, 'app'), join(out, 'app'));
copyTree(join(here, 'screenshots'), join(out, 'screenshots'));

// The run must be deterministic: build the dossier twice and refuse to write it unless both
// builds agree byte for byte, so a bad run fails loudly instead of handing in a flaky entry.
const dossier = buildDossier(out, DOSSIER_CAPS);
const again = buildDossier(out, DOSSIER_CAPS);
if (!Buffer.from(dossier).equals(Buffer.from(again))) throw new Error('main.ts: dossier is not deterministic across two builds');
writeFileSync(join(out, 'dossier.json'), dossier);
