import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { GenerativeError } from '../src/generative.mjs';
import { createApp } from '../src/server.mjs';

const fakeGenerative = async (message) => ({
  category: 'ACCESS',
  priority: 'MEDIUM',
  response: `Respuesta generada para: ${message}`,
  requiresHumanReview: false,
  mode: 'generative',
});

async function startApp(app) {
  app.listen(0, '127.0.0.1');
  await once(app, 'listening');
  return `http://127.0.0.1:${app.address().port}/api/analyze`;
}

const stopApp = (app) => new Promise((resolve) => {
  app.close(resolve);
  app.closeAllConnections();
});

test('API HTTP: clasificación, validación y errores controlados', async (t) => {
  const server = createApp({ generative: fakeGenerative });
  const url = await startApp(server);
  t.after(() => stopApp(server));

  const post = (body, contentType = 'application/json') => fetch(url, {
    method: 'POST', headers: { 'Content-Type': contentType }, body,
  });

  await t.test('procesa los casos de referencia por HTTP', async () => {
    const cases = JSON.parse(await readFile(new URL('../fixtures/support-cases.json', import.meta.url), 'utf8'));
    assert.ok(cases.length >= 10);
    for (const item of cases) {
      const response = await post(JSON.stringify({ message: item.message, mode: 'traditional' }));
      assert.equal(response.status, 200, item.id);
      const result = await response.json();
      assert.equal(result.category, item.expected.category, item.id);
      assert.equal(result.priority, item.expected.priority, item.id);
      assert.equal(result.requiresHumanReview, item.expected.requiresHumanReview, item.id);
      assert.equal(result.mode, 'traditional');
      assert.equal(typeof result.response, 'string');
      assert.ok(result.response.length > 0);
    }
  });

  await t.test('responde en modo generativo con el mismo contrato', async () => {
    const response = await post(JSON.stringify({ message: 'No puedo entrar.', mode: 'generative' }));
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.deepEqual(Object.keys(result).sort(), ['category', 'mode', 'priority', 'requiresHumanReview', 'response']);
    assert.equal(result.mode, 'generative');
    assert.ok(result.response.includes('No puedo entrar.'));
  });

  await t.test('rechaza JSON, campos y tamaños inválidos', async () => {
    for (const body of ['{', 'null', '[]', '{}', JSON.stringify({ message: ' ', mode: 'traditional' }), JSON.stringify({ message: 'hola', mode: 'otro' }), JSON.stringify({ message: 12, mode: 'traditional' }), JSON.stringify({ message: 'x'.repeat(5001), mode: 'traditional' })]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal((await post('{}', 'text/plain')).status, 415);
    assert.equal((await post(JSON.stringify({ message: 'x'.repeat(40000), mode: 'traditional' }))).status, 413);
    assert.equal((await post(JSON.stringify({ message: 'hola', mode: 'traditional' }), 'application/json; charset=utf-8')).status, 200);
  });

  await t.test('rechaza rutas y métodos no disponibles', async () => {
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(`${url}?x=1`)).status, 405);
    assert.equal((await fetch(`${url}/otro`)).status, 404);
  });
});

test('API HTTP: traduce errores del proveedor generativo', async (t) => {
  const statuses = {
    GENERATIVE_TIMEOUT: 504,
    GENERATIVE_UNAVAILABLE: 503,
    GENERATIVE_NOT_CONFIGURED: 503,
    GENERATIVE_PROVIDER_ERROR: 502,
    GENERATIVE_INVALID_OUTPUT: 502,
  };
  const server = createApp({
    generative: async (message) => {
      throw new GenerativeError(message, 'Fallo controlado del proveedor.', statuses[message]);
    },
  });
  const url = await startApp(server);
  t.after(() => stopApp(server));

  for (const [code, status] of Object.entries(statuses)) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: code, mode: 'generative' }),
    });
    assert.equal(response.status, status, code);
    const body = await response.json();
    assert.equal(body.code, code);
    assert.equal(body.error, 'Fallo controlado del proveedor.');
  }
});
