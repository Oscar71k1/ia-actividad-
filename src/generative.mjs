import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, MAX_MESSAGE_LENGTH, ModelOutputError, PRIORITIES, validateAnalysis } from './contract.mjs';

// Carga opcional de .env (ignorado por git) sin depender de paquetes externos.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) {
  try {
    loadEnvFile(envFile);
  } catch {
    // Un .env inválido no debe impedir el arranque; se usan los valores por defecto.
  }
}

const SYSTEM_PROMPT = (await readFile(new URL('../prompts/support-system.txt', import.meta.url), 'utf8')).trim();

// Esquema entregado a Ollama para restringir la generación al contrato común.
const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    priority: { type: 'string', enum: PRIORITIES },
    response: { type: 'string' },
    requiresHumanReview: { type: 'boolean' },
    mode: { type: 'string', enum: ['generative'] },
  },
  required: ['category', 'priority', 'response', 'requiresHumanReview', 'mode'],
  additionalProperties: false,
};

/** Error controlado del proveedor generativo; el servidor lo traduce a HTTP. */
export class GenerativeError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'GenerativeError';
    this.code = code;
    this.status = status;
  }
}

/** Configuración del proveedor local. Se lee en cada llamada para facilitar pruebas. */
export function getGenerativeConfig(env = process.env) {
  const rawTimeout = Number(env.OLLAMA_TIMEOUT_MS ?? 120000);
  return {
    baseUrl: (env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/+$/, ''),
    model: env.OLLAMA_MODEL || 'qwen2.5:3b',
    timeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 120000,
  };
}

function parseModelJson(content) {
  let text = content.trim();
  // Tolerancia a bloques Markdown, aunque el prompt pide JSON puro.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();
  try {
    return JSON.parse(text);
  } catch {
    throw new GenerativeError('GENERATIVE_INVALID_OUTPUT', 'El modelo no devolvió un JSON válido.', 502);
  }
}

/**
 * Clasifica una solicitud con un modelo generativo servido por Ollama.
 * El mensaje del usuario viaja como rol "user", nunca concatenado al prompt
 * de sistema, y la salida se valida contra el contrato común.
 */
export async function analyzeGenerative(message, options = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    throw new TypeError(`El mensaje debe ser un texto de entre 1 y ${MAX_MESSAGE_LENGTH} caracteres y no estar vacío.`);
  }

  const config = getGenerativeConfig();
  const baseUrl = options.baseUrl ?? config.baseUrl;
  const model = options.model ?? config.model;
  const timeoutMs = options.timeoutMs ?? config.timeoutMs;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  const body = {
    model,
    stream: false,
    format: OUTPUT_SCHEMA,
    options: { temperature: 0 },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
  };

  let response;
  try {
    response = await fetchImpl(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new GenerativeError('GENERATIVE_TIMEOUT', `El proveedor no respondió en ${timeoutMs} ms.`, 504);
    }
    throw new GenerativeError('GENERATIVE_UNAVAILABLE', 'No se pudo conectar con el proveedor generativo local.', 503);
  }

  if (!response.ok) {
    // No se propaga el cuerpo del proveedor para no filtrar información sensible.
    throw new GenerativeError('GENERATIVE_PROVIDER_ERROR', `El proveedor generativo respondió con HTTP ${response.status}.`, 502);
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new GenerativeError('GENERATIVE_INVALID_OUTPUT', 'La respuesta del proveedor no es JSON.', 502);
  }

  const content = payload?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new GenerativeError('GENERATIVE_INVALID_OUTPUT', 'La respuesta del proveedor no contiene message.content.', 502);
  }

  const parsed = parseModelJson(content);
  try {
    return validateAnalysis(parsed, { mode: 'generative' });
  } catch (error) {
    if (error instanceof ModelOutputError) {
      throw new GenerativeError('GENERATIVE_INVALID_OUTPUT', error.message, 502);
    }
    throw error;
  }
}
