import { execFileSync, spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'no disponible';
  }
}

const result = spawnSync(process.execPath, ['examples/traditional.mjs'], {
  cwd: root,
  encoding: 'utf8',
});

const content = [
  `Fecha UTC: ${new Date().toISOString()}`,
  `Commit evaluado: ${currentCommit()}`,
  `Node: ${process.version}`,
  '',
  'Comando: node examples/traditional.mjs',
  '',
  result.stdout ?? '',
  result.stderr ?? '',
].join('\n');

await writeFile(new URL('../evidence/examples.txt', import.meta.url), content);
process.stdout.write(result.stdout ?? '');
process.stderr.write(result.stderr ?? '');
if (result.status !== 0) process.exitCode = result.status ?? 1;
