import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { analyzeTraditional } from './traditional.mjs';

function reply(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export function createApp() {
  return createServer(async (req, res) => {
    try {
      if (req.url !== '/api/analyze') return reply(res, 404, { error: 'Ruta no encontrada.' });
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
        if (size > 32768) {
          reply(res, 413, { error: 'La petición supera 32 KiB.' });
          return;
        }
        chunks.push(chunk);
      }
      let data;
      try {
        data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return reply(res, 400, { error: 'JSON inválido.' });
      }
      if (!data || Array.isArray(data) || typeof data !== 'object' ||
          typeof data.message !== 'string' || !data.message.trim() || data.message.length > 5000 ||
          !['traditional', 'generative'].includes(data.mode)) {
        return reply(res, 400, { error: 'Envíe message como texto no vacío de hasta 5000 caracteres y mode como traditional o generative.' });
      }
      if (data.mode === 'generative') {
        return reply(res, 501, { error: 'El motor generativo está pendiente de integración.', code: 'GENERATIVE_NOT_IMPLEMENTED' });
      }
      reply(res, 200, analyzeTraditional(data.message));
    } catch {
      if (!res.headersSent && !res.destroyed) reply(res, 500, { error: 'No se pudo procesar la solicitud.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT debe estar entre 1 y 65535.');
  const server = createApp();
  server.on('error', (error) => {
    console.error(`No se pudo iniciar el servidor (${error.code}).`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log(`API disponible en http://127.0.0.1:${port}/api/analyze`));
}
