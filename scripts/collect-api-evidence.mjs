import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { evaluateCase } from '../src/comparison.mjs';
import { getGenerativeConfig } from '../src/generative.mjs';
import { createApp } from '../src/server.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const cases = JSON.parse(await readFile(new URL('../fixtures/support-cases.json', import.meta.url), 'utf8'));
const config = getGenerativeConfig();
const delayMs = Number(process.env.EVIDENCE_DELAY_MS ?? 3000);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

const server = createApp();
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const endpoint = `${baseUrl}/api/analyze`;

const post = async (body, contentType = 'application/json') => {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': contentType }, body });
  return { status: response.status, body: await response.json() };
};

const evidence = {
  timestamp: new Date().toISOString(),
  commit: currentCommit(),
  node: process.version,
  endpoint,
  provider: { type: config.provider, label: config.label, model: config.model, baseUrl: config.baseUrl, timeoutMs: config.timeoutMs },
  cases: [],
  validation: [],
  routes: [],
};

try {
  for (const testCase of cases) {
    for (const mode of ['traditional', 'generative']) {
      const started = Date.now();
      let response;
      let error = null;
      try {
        response = await post(JSON.stringify({ message: testCase.message, mode }));
      } catch (cause) {
        error = { name: cause.name, code: cause.code ?? null, message: cause.message };
      }

      const result = response?.status === 200 ? response.body : null;
      const evaluation = evaluateCase(testCase, result, { mode });
      evidence.cases.push({
        id: testCase.id,
        type: testCase.type,
        mode,
        request: { message: testCase.message, mode },
        status: response?.status ?? null,
        response: response?.body ?? null,
        error,
        expected: testCase.expected,
        ...evaluation,
        result,
        durationMs: Date.now() - started,
      });
      console.log(`${testCase.id} ${mode.padEnd(10)} HTTP ${response?.status ?? 'ERR'}  ${evaluation.correct ? 'ACIERTO' : 'FALLO'}`);
      // Espacia las llamadas al proveedor para respetar los límites de tasa.
      if (mode === 'generative' && Number.isFinite(delayMs) && delayMs > 0) await pause(delayMs);
    }
  }

  const probes = [
    { name: 'JSON inválido', body: '{', contentType: 'application/json' },
    { name: 'cuerpo null', body: 'null', contentType: 'application/json' },
    { name: 'arreglo como cuerpo', body: '[]', contentType: 'application/json' },
    { name: 'objeto vacío', body: '{}', contentType: 'application/json' },
    { name: 'message vacío', body: JSON.stringify({ message: '   ', mode: 'traditional' }), contentType: 'application/json' },
    { name: 'message no textual', body: JSON.stringify({ message: 12, mode: 'traditional' }), contentType: 'application/json' },
    { name: 'mode inválido', body: JSON.stringify({ message: 'hola', mode: 'otro' }), contentType: 'application/json' },
    { name: 'message mayor a 5000 caracteres', body: JSON.stringify({ message: 'x'.repeat(5001), mode: 'traditional' }), contentType: 'application/json' },
    { name: 'Content-Type distinto de JSON', body: '{}', contentType: 'text/plain' },
    { name: 'cuerpo mayor a 32 KiB', body: JSON.stringify({ message: 'x'.repeat(40000), mode: 'traditional' }), contentType: 'application/json' },
  ];

  for (const probe of probes) {
    try {
      const response = await post(probe.body, probe.contentType);
      evidence.validation.push({ name: probe.name, status: response.status, response: response.body });
      console.log(`validación ${probe.name.padEnd(36)} HTTP ${response.status}`);
    } catch (cause) {
      evidence.validation.push({ name: probe.name, status: null, error: { name: cause.name, message: cause.message } });
      console.log(`validación ${probe.name.padEnd(36)} ERROR`);
    }
  }

  for (const route of [
    { name: 'GET /api/analyze', method: 'GET', path: '/api/analyze' },
    { name: 'GET /api/analyze?x=1', method: 'GET', path: '/api/analyze?x=1' },
    { name: 'GET /api/otra', method: 'GET', path: '/api/otra' },
  ]) {
    const response = await fetch(`${baseUrl}${route.path}`, { method: route.method });
    evidence.routes.push({
      name: route.name,
      method: route.method,
      path: route.path,
      status: response.status,
      allow: response.headers.get('allow'),
      response: await response.json(),
    });
    console.log(`${route.name.padEnd(28)} HTTP ${response.status}`);
  }
} finally {
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
}

await writeFile(new URL('../evidence/api.json', import.meta.url), `${JSON.stringify(evidence, null, 2)}\n`);
console.log('Evidencia: evidence/api.json');
