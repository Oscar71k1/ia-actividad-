import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { analyzeGenerative, GenerativeError, getGenerativeConfig } from '../src/generative.mjs';

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
  const result = await analyzeGenerative(message, { provider: 'ollama', baseUrl: url, model: 'modelo-falso', timeoutMs: 5000 });

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
      () => analyzeGenerative('hola', { provider: 'ollama', baseUrl: url, timeoutMs: 5000 }),
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
  const result = await analyzeGenerative('Se cierra.', { provider: 'ollama', baseUrl: url, timeoutMs: 5000 });
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
    () => analyzeGenerative('hola', { provider: 'ollama', baseUrl: url, timeoutMs: 5000 }),
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
    () => analyzeGenerative('hola', { provider: 'ollama', baseUrl: url, timeoutMs: 2000 }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_UNAVAILABLE' && error.status === 503,
  );
});

test('señala tiempo de espera agotado', async (t) => {
  const { server, url } = await startFake(() => new Promise(() => {}));
  t.after(() => stopFake(server));
  await assert.rejects(
    () => analyzeGenerative('hola', { provider: 'ollama', baseUrl: url, timeoutMs: 50 }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_TIMEOUT' && error.status === 504,
  );
});

test('rechaza mensajes inválidos antes de llamar al proveedor', async () => {
  for (const message of [null, undefined, 123, {}, '', '   ', 'a'.repeat(5001)]) {
    await assert.rejects(() => analyzeGenerative(message), TypeError);
  }
});

const groqEnvelope = (content) => JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] });

test('configura Ollama por defecto y Groq por variables de entorno', () => {
  assert.deepEqual(getGenerativeConfig({}), {
    provider: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://127.0.0.1:11434',
    model: 'qwen2.5:3b',
    timeoutMs: 120000,
    apiKey: null,
    apiKeyEnv: null,
    requiresApiKey: false,
  });

  assert.deepEqual(getGenerativeConfig({
    GENERATIVE_PROVIDER: 'groq',
    GROQ_API_KEY: '  clave-de-prueba  ',
    GROQ_MODEL: 'modelo-nube',
    GROQ_URL: 'https://ejemplo.test/v1///',
    GROQ_TIMEOUT_MS: '1500',
  }), {
    provider: 'groq',
    label: 'Groq',
    baseUrl: 'https://ejemplo.test/v1',
    model: 'modelo-nube',
    timeoutMs: 1500,
    apiKey: 'clave-de-prueba',
    apiKeyEnv: 'GROQ_API_KEY',
    requiresApiKey: true,
  });

  assert.throws(
    () => getGenerativeConfig({ GENERATIVE_PROVIDER: 'desconocido' }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_NOT_CONFIGURED',
  );
});

test('usa el endpoint compatible con OpenAI de Groq y extrae choices[].message.content', async (t) => {
  let captured;
  let capturedUrl;
  let capturedAuth;
  const { server, url } = await startFake(async (req, res) => {
    capturedUrl = req.url;
    capturedAuth = req.headers.authorization;
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    captured = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(groqEnvelope(JSON.stringify({
      category: 'BUG',
      priority: 'HIGH',
      response: '  Revise el estado.  ',
      requiresHumanReview: false,
      mode: 'generative',
    })));
  });
  t.after(() => stopFake(server));

  const result = await analyzeGenerative('La app falla para todos.', {
    provider: 'groq',
    baseUrl: url,
    model: 'modelo-nube',
    apiKey: 'clave-de-prueba',
    timeoutMs: 5000,
  });

  assert.equal(capturedUrl, '/chat/completions');
  assert.equal(capturedAuth, 'Bearer clave-de-prueba');
  assert.equal(captured.model, 'modelo-nube');
  assert.equal(captured.stream, false);
  assert.equal(captured.temperature, 0);
  assert.deepEqual(captured.response_format, { type: 'json_object' });
  assert.equal(captured.messages.length, 2);
  assert.equal(captured.messages[0].role, 'system');
  assert.equal(captured.messages[1].role, 'user');
  assert.deepEqual(result, {
    category: 'BUG',
    priority: 'HIGH',
    response: 'Revise el estado.',
    requiresHumanReview: false,
    mode: 'generative',
  });
});

test('exige la API key cuando el proveedor es Groq', async () => {
  await assert.rejects(
    () => analyzeGenerative('hola', { provider: 'groq', apiKey: '', baseUrl: 'http://127.0.0.1:1', timeoutMs: 100 }),
    (error) => error instanceof GenerativeError
      && error.code === 'GENERATIVE_NOT_CONFIGURED'
      && error.status === 503
      && error.message.includes('GROQ_API_KEY'),
  );
});

test('rechaza proveedores desconocidos', async () => {
  await assert.rejects(
    () => analyzeGenerative('hola', { provider: 'inexistente' }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_NOT_CONFIGURED' && error.status === 503,
  );
});

test('reintenta cuando el proveedor limita la tasa (HTTP 429)', async (t) => {
  let calls = 0;
  const { server, url } = await startFake((req, res) => {
    calls += 1;
    if (calls < 3) {
      res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' });
      res.end('{}');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(groqEnvelope(JSON.stringify({
      category: 'ACCESS',
      priority: 'MEDIUM',
      response: 'Verifique sus credenciales.',
      requiresHumanReview: false,
    })));
  });
  t.after(() => stopFake(server));

  const result = await analyzeGenerative('No puedo entrar.', {
    provider: 'groq',
    baseUrl: url,
    model: 'modelo-nube',
    apiKey: 'clave-de-prueba',
    timeoutMs: 5000,
  });

  assert.equal(calls, 3);
  assert.equal(result.category, 'ACCESS');
});

test('agota los reintentos de tasa y devuelve error del proveedor', async (t) => {
  let calls = 0;
  const { server, url } = await startFake((req, res) => {
    calls += 1;
    res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '0' });
    res.end('{}');
  });
  t.after(() => stopFake(server));

  await assert.rejects(
    () => analyzeGenerative('hola', {
      provider: 'groq',
      baseUrl: url,
      model: 'modelo-nube',
      apiKey: 'clave-de-prueba',
      timeoutMs: 5000,
    }),
    (error) => error instanceof GenerativeError && error.code === 'GENERATIVE_PROVIDER_ERROR' && error.status === 502,
  );
  assert.equal(calls, 4);
});
