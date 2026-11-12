import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/server.mjs';

test('API HTTP: clasificación, validación y modo pendiente', async (t) => {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const url = `http://127.0.0.1:${server.address().port}/api/analyze`;
  const post = (body, contentType = 'application/json') => fetch(url, {
    method: 'POST', headers: { 'Content-Type': contentType }, body,
  });

  await t.test('procesa los diez casos de referencia por HTTP', async () => {
    const cases = JSON.parse(await readFile(new URL('../fixtures/support-cases.json', import.meta.url), 'utf8'));
    assert.equal(cases.length, 10);
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
  await t.test('rechaza JSON, campos y tamaños inválidos', async () => {
    for (const body of ['{', 'null', '[]', '{}', JSON.stringify({ message: ' ', mode: 'traditional' }), JSON.stringify({ message: 'hola', mode: 'otro' }), JSON.stringify({ message: 12, mode: 'traditional' }), JSON.stringify({ message: 'x'.repeat(5001), mode: 'traditional' })]) {
      assert.equal((await post(body)).status, 400);
    }
    assert.equal((await post('{}', 'text/plain')).status, 415);
    assert.equal((await post(JSON.stringify({ message: 'x'.repeat(40000), mode: 'traditional' }))).status, 413);
  });
  await t.test('señala explícitamente el generativo pendiente', async () => {
    const response = await post(JSON.stringify({ message: 'No puedo entrar.', mode: 'generative' }));
    assert.equal(response.status, 501);
    assert.equal((await response.json()).code, 'GENERATIVE_NOT_IMPLEMENTED');
  });
  await t.test('rechaza rutas y métodos no disponibles', async () => {
    assert.equal((await fetch(url)).status, 405);
    assert.equal((await fetch(`${url}/otro`)).status, 404);
  });
});
