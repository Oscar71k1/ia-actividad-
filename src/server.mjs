import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { parseAnalyzeRequest, RequestError } from './contract.mjs';
import { analyzeGenerative, GenerativeError, getGenerativeConfig } from './generative.mjs';
import { analyzeTraditional } from './traditional.mjs';

const MAX_BODY_BYTES = 32 * 1024;

function reply(res, status, body) {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

export function createApp({ generative = analyzeGenerative } = {}) {
  return createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url ?? '/', 'http://localhost');
      if (pathname !== '/api/analyze') return reply(res, 404, { error: 'Ruta no encontrada.' });
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return reply(res, 405, { error: 'Utilice POST.' });
      }
      if (req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json') {
        return reply(res, 415, { error: 'Utilice Content-Type: application/json.' });
      }

      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          // Se cierra la conexión después de enviar la respuesta para no dejar
          // el cuerpo restante sin consumir.
          res.on('finish', () => req.destroy());
          return reply(res, 413, { error: 'La petición supera 32 KiB.' });
        }
        chunks.push(chunk);
      }

      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reply(res, 400, { error: 'JSON inválido.' });
      }

      const { message, mode } = parseAnalyzeRequest(data);
      const result = mode === 'traditional' ? analyzeTraditional(message) : await generative(message);
      return reply(res, 200, result);
    } catch (error) {
      if (error instanceof RequestError) return reply(res, 400, { error: error.message });
      if (error instanceof GenerativeError) {
        return reply(res, error.status, { error: error.message, code: error.code });
      }
      if (!res.headersSent && !res.destroyed) reply(res, 500, { error: 'No se pudo procesar la solicitud.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
  const config = (() => {
    try {
      return getGenerativeConfig();
    } catch (error) {
      console.error(error.message);
      process.exit(1);
    }
  })();
  const { label, model, baseUrl } = config;
  const server = createApp();
  server.on('error', (error) => {
    console.error(`No se pudo iniciar el servidor (${error.code}).`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`API disponible en http://127.0.0.1:${port}/api/analyze`);
    console.log(`Motor generativo: ${label} ${model} en ${baseUrl}`);
    if (config.requiresApiKey && !config.apiKey) {
      console.warn(`Aviso: falta ${config.apiKeyEnv}; el motor generativo responderá 503.`);
    }
  });
}
