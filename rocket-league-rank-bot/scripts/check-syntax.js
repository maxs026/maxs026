// Vérification de syntaxe de tous les fichiers JS du projet (aucune dépendance supplémentaire).
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) files.push(p);
  }
};
['src', 'test', 'scripts'].forEach(walk);

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status !== 0) {
    failed += 1;
    console.error(`✗ ${f}\n${r.stderr}`);
  }
}
console.log(`${files.length - failed}/${files.length} fichiers valides`);
process.exit(failed ? 1 : 0);
