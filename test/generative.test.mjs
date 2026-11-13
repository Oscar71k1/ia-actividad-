import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { analyzeGenerative, GenerativeError } from '../src/generative.mjs';

async function startFake(handler) {
  const server = createServer((req, res) => {
    req.on('error', () => {});
    res.on('error', () => {});
    Promise.resolve(handler(req, res)).catch(() => {});
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

const stopFake = (server) => new Promise((resolve) => {
  server.close(resolve);
  server.closeAllConnections();
});

const ollamaEnvelope = (content) => JSON.stringify({ message: { role: 'assistant', content } });

test('envía el mensaje como rol user y normaliza la salida', async (t) => {
  let captured;
  const { server, url } = await startFake(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    captured = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(ollamaEnvelope(JSON.stringify({
      category: 'SECURITY',
      priority: 'LOW',
      response: '  Revise el caso.  ',
      requiresHumanReview: false,
      mode: 'generative',
    })));
  });
  t.after(() => stopFake(server));

  const message = 'Hay un problema en mi cuenta.';
  const result = await analyzeGenerative(message, { baseUrl: url, model: 'modelo-falso', timeoutMs: 5000 });

  assert.equal(captured.model, 'modelo-falso');
  assert.equal(captured.stream, false);
  assert.equal(captured.format.type, 'object');
  assert.deepEqual(captured.format.properties.category.enum, ['ACCESS', 'BUG', 'FEATURE', 'SECURITY']);
  assert.equal(captured.options.temperature, 0);
  assert.equal(captured.messages.length, 2);
  assert.equal(captured.messages[0].role, 'system');
  assert.ok(captured.messages[0].content.includes('asistente'));
  assert.equal(captured.messages[1].role, 'user');
  assert.equal(captured.messages[1].content, message);
  assert.equal(captured.messages[0].content.includes(message), false);

  assert.deepEqual(result, {
    category: 'SECURITY',
    priority: 'LOW',
    response: 'Revise el caso.',
    requiresHumanReview: true,
    mode: 'generative',
  });
});

test('rechaza JSON inválido y salidas fuera del contrato', async (t) => {
  for (const content of ['no es json', JSON.stringify({ category: 'OTRO', priority: 'LOW', response: 'x', requiresHumanReview: false }), JSON.stringify({ category: 'BUG', priority: 'LOW', response: '', requiresHumanReview: false })]) {
    const { server, url } = await startFake((req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(ollamaEnvelope(content));
    });
    await assert.rejects(
      () => analyzeGenerative('hola', { baseUrl: url, timeoutMs: 5000 }),
      (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_INVALID_OUTPUT' && error.status === 502,
    );
    await stopFake(server);
  }
});

test('acepta JSON dentro de un bloque Markdown', async (t) => {
  const content = '```json\n' + JSON.stringify({ category: 'BUG', priority: 'MEDIUM', response: 'Revise los pasos.', requiresHumanReview: false }) + '\n```';
  const { server, url } = await startFake((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(ollamaEnvelope(content));
  });
  t.after(() => stopFake(server));
  const result = await analyzeGenerative('Se cierra.', { baseUrl: url, timeoutMs: 5000 });
  assert.equal(result.category, 'BUG');
  assert.equal(result.mode, 'generative');
});

test('no filtra el cuerpo del proveedor cuando responde con error', async (t) => {
  const { server, url } = await startFake((req, res) => {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('secreto interno del proveedor');
  });
  t.after(() => stopFake(server));

  await assert.rejects(
    () => analyzeGenerative('hola', { baseUrl: url, timeoutMs: 5000 }),
    (error) => {
      assert.ok(error instanceof GenerativeError);
      assert.equal(error.code, 'GENERATIVE_PROVIDER_ERROR');
      assert.equal(error.status, 502);
      assert.equal(error.message.includes('secreto interno'), false);
      return true;
    },
  );
});

test('señala proveedor no disponible', async (t) => {
  const { server, url } = await startFake((req, res) => res.end());
  await stopFake(server);
  t.after(() => {});
  await assert.rejects(
    () => analyzeGenerative('hola', { baseUrl: url, timeoutMs: 2000 }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_UNAVAILABLE' && error.status === 503,
  );
});

test('señala tiempo de espera agotado', async (t) => {
  const { server, url } = await startFake(() => new Promise(() => {}));
  t.after(() => stopFake(server));
  await assert.rejects(
    () => analyzeGenerative('hola', { baseUrl: url, timeoutMs: 50 }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_TIMEOUT' && error.status === 504,
  );
});

test('rechaza mensajes inválidos antes de llamar al proveedor', async () => {
  for (const message of [null, undefined, 123, {}, '', '   ', 'a'.repeat(5001)]) {
    await assert.rejects(() => analyzeGenerative(message), TypeError);
  }
});
