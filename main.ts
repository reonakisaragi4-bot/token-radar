// Token launch radar: a small command-line driver for the model in lib/model.ts.
//
// Feed it the sealed DefiLlama snapshot and it hands back a ranked board of pre-token
// protocols, the dataset the dashboard page reads, and the dossier the judge opens.
// Everything runs locally: Node 22, standard library only, no network, no framework.
// The dashboard itself is a static page — dashboard/index.html, dashboard/app.css and
// dashboard/app.js — and it reads the data.js this driver writes beside it.
//
// Usage, outside the grader (where /input and /output are mounted for you):
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// The flags are --input <snapshot.json or a directory holding one> and --output <dir>.
// --output wins over MAKEFUN_OUTPUT_DIR when both are given.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar } from './lib/model.ts';
import { dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier as makeDossier } from './vendor/makefun-board.ts';

/** The folder this file lives in: dashboard/ and screenshots/ sit beside it. */
const root = fileURLToPath(new URL('.', import.meta.url));

/** Caps the scorer enforces (reference/gate.json): dossier text, screenshots, dashboard. */
const DOSSIER_CAPS = {
  text_max_bytes: 65_536,
  screenshots: { max: 4, max_bytes: 524_288 },
  dashboard: { max_files: 400, max_bytes: 4_194_304 },
};

/** Screenshot file names: letters, digits and . _ -, between 1 and 128 characters. */
const SHOT_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Read one --name value from the command line: `--name value` or `--name=value`. */
function flag(name: string, fallback: string): string {
  const argv = process.argv;
  const at = argv.indexOf(`--${name}`);
  if (at !== -1 && at + 1 < argv.length) return argv[at + 1]!;
  const joined = argv.find((a) => a.startsWith(`--${name}=`));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

/** Copy a directory's plain files into `to`, skipping dotfiles; returns the names copied. */
function copyDir(from: string, to: string): string[] {
  if (!fs.existsSync(from)) return [];
  fs.mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of fs.readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const source = path.join(from, name);
    if (!fs.statSync(source).isFile()) continue;
    fs.copyFileSync(source, path.join(to, name));
    copied.push(name);
  }
  return copied;
}

function main(): void {
  const inputFlag = flag('input', '/input');
  const inputFile = inputFlag.endsWith('.json') ? inputFlag : path.join(inputFlag, 'snapshot.json');
  if (!fs.existsSync(inputFile)) {
    process.stderr.write(
      `token radar: cannot find a snapshot at ${inputFile} — pass --input <snapshot.json|directory> or mount the sealed /input\n`,
    );
    process.exit(2);
  }
  const out = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshot = parseSnapshot(fs.readFileSync(inputFile, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    process.stderr.write(`token radar: refusing to write a board the gate would reject: ${issue}\n`);
    process.exit(1);
  }

  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'board.json'), JSON.stringify({ rows: board }) + '\n');
  fs.writeFileSync(path.join(out, 'data.js'), dataScript(radar));

  copyDir(path.join(root, 'dashboard'), path.join(out, 'dashboard'));
  const shots = copyDir(path.join(root, 'screenshots'), path.join(out, 'screenshots'));
  if (shots.length < 3) {
    process.stderr.write(
      `token radar: only ${shots.length} screenshot${shots.length === 1 ? '' : 's'} in screenshots/ — hand in 3: the board, a detail view and a filtered view\n`,
    );
    process.exit(1);
  }
  for (const name of shots) {
    if (!SHOT_NAME.test(name)) {
      process.stderr.write(
        `token radar: screenshots/${name} is not a valid file name (letters, digits, . _ -, 1-128 characters)\n`,
      );
      process.exit(1);
    }
  }

  // The dossier goes last: the scorer rebuilds it from this /output and compares bytes.
  fs.writeFileSync(path.join(out, 'dossier.json'), makeDossier(out, DOSSIER_CAPS));

  process.stdout.write(
    `token radar: scored ${board.length} rows from ${snapshot.protocols.length} protocols (${snapshot.watchlist.length} on the watchlist; ${radar.early_size} early, ${radar.live_size} live set aside)\n` +
      `token radar: wrote ${path.join(out, 'board.json')}, ${path.join(out, 'data.js')}, ${path.join(out, 'dashboard')} (3 files), ${path.join(out, 'screenshots')} (${shots.length} images) and ${path.join(out, 'dossier.json')}\n`,
  );
}

main();
