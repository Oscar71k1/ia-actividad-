import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateCase, summarize } from '../src/comparison.mjs';
import { analyzeGenerative, getGenerativeConfig } from '../src/generative.mjs';
import { analyzeTraditional } from '../src/traditional.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cases = JSON.parse(await readFile(new URL('../fixtures/support-cases.json', import.meta.url), 'utf8'));
const config = getGenerativeConfig();

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const startedAt = new Date().toISOString();
const rows = [];

for (const mode of ['traditional', 'generative']) {
  for (const testCase of cases) {
    const started = Date.now();
    let result = null;
    let error = null;
    try {
      result = mode === 'traditional'
        ? analyzeTraditional(testCase.message)
        : await analyzeGenerative(testCase.message);
    } catch (cause) {
      error = { name: cause.name, code: cause.code ?? null, message: cause.message };
    }

    const evaluation = evaluateCase(testCase, result, { mode });
    rows.push({
      id: testCase.id,
      type: testCase.type,
      mode,
      message: testCase.message,
      ...evaluation,
      result,
      error,
      durationMs: Date.now() - started,
    });
    console.log(`${testCase.id} ${mode.padEnd(10)} ${evaluation.correct ? 'ACIERTO' : 'FALLO  '}  ${evaluation.category ?? '-'} / ${evaluation.priority ?? '-'}${error ? `  (${error.code ?? error.name})` : ''}`);
  }
}

const summaries = {
  traditional: summarize(rows.filter((row) => row.mode === 'traditional')),
  generative: summarize(rows.filter((row) => row.mode === 'generative')),
};

const report = {
  timestamp: startedAt,
  commit: currentCommit(),
  node: process.version,
  provider: { type: 'ollama', model: config.model, baseUrl: config.baseUrl, timeoutMs: config.timeoutMs },
  caseCount: cases.length,
  summaries,
  rows,
};

const cell = (row) => {
  if (!row) return '-';
  if (row.error) return `❌ ${row.error.code ?? 'ERROR'}`;
  return `${row.correct ? '✅' : '❌'} ${row.category} / ${row.priority}`;
};

const formatRow = (label, summary) =>
  `| ${label} | ${summary.correct}/${summary.total} | ${summary.percent}% | ${summary.formatValid}/${summary.total} (${summary.formatPercent}%) | ${summary.reviewMatchesExpected}/${summary.total} (${summary.reviewPercent}%) |`;

const errors = rows.filter((row) => row.error);

const markdown = [
  '# Comparación de motores',
  '',
  `- Fecha UTC: ${startedAt}`,
  `- Commit: ${report.commit ?? 'no disponible'}`,
  `- Node: ${process.version}`,
  `- Proveedor: Ollama (${config.model}) en ${config.baseUrl}`,
  `- Casos: ${cases.length}`,
  '',
  'Un acierto exige coincidir en categoría y prioridad. Un error del proveedor cuenta como caso no acertado.',
  '',
  '## Resultados por motor',
  '',
  '| Motor | Aciertos | Porcentaje | Formato válido | Revisión humana correcta |',
  '| --- | ---: | ---: | ---: | ---: |',
  formatRow('Tradicional', summaries.traditional),
  formatRow('Generativo', summaries.generative),
  '',
  '## Detalle por caso',
  '',
  '| Caso | Tipo | Esperado | Tradicional | Generativo |',
  '| --- | --- | --- | --- | --- |',
  ...cases.map((testCase) => {
    const traditional = rows.find((row) => row.id === testCase.id && row.mode === 'traditional');
    const generative = rows.find((row) => row.id === testCase.id && row.mode === 'generative');
    return `| ${testCase.id} | ${testCase.type} | ${testCase.expected.category} / ${testCase.expected.priority} | ${cell(traditional)} | ${cell(generative)} |`;
  }),
  '',
  '## Errores del proveedor',
  '',
  errors.length === 0
    ? 'No se registraron errores del proveedor generativo.'
    : errors.map((row) => `- ${row.id} (${row.mode}): ${row.error.code ?? row.error.name} — ${row.error.message}`).join('\n'),
  '',
].join('\n');

await writeFile(new URL('../evidence/comparison.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(new URL('../evidence/comparison.md', import.meta.url), markdown);

console.log('\nResumen');
console.log(`Tradicional: ${summaries.traditional.correct}/${summaries.traditional.total} (${summaries.traditional.percent}%)`);
console.log(`Generativo:  ${summaries.generative.correct}/${summaries.generative.total} (${summaries.generative.percent}%)`);
console.log('Evidencias: evidence/comparison.json y evidence/comparison.md');
