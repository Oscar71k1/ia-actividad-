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

// Esquema del contrato común. Ollama lo aplica con `format`; en Groq la salida
// se pide como JSON y se valida después. En ambos casos la validación es la misma.
export const OUTPUT_SCHEMA = {
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

/**
 * Adaptadores de proveedor. Cada uno concentra URL, cabeceras, cuerpo y
 * extracción del texto; el resto del flujo (roles, validación y errores) es común.
 */
const PROVIDERS = {
  ollama: {
    label: 'Ollama',
    requiresApiKey: false,
    defaultBaseUrl: 'http://127.0.0.1:11434',
    defaultModel: 'qwen2.5:3b',
    defaultTimeoutMs: 120000,
    env: { baseUrl: 'OLLAMA_URL', model: 'OLLAMA_MODEL', timeoutMs: 'OLLAMA_TIMEOUT_MS' },
    buildRequest({ baseUrl, model, messages }) {
      return {
        url: `${baseUrl}/api/chat`,
        headers: {},
        body: {
          model,
          stream: false,
          format: OUTPUT_SCHEMA,
          options: { temperature: 0 },
          messages,
        },
      };
    },
    extractContent(payload) {
      return payload?.message?.content;
    },
  },
  groq: {
    label: 'Groq',
    requiresApiKey: true,
    apiKeyEnv: 'GROQ_API_KEY',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-120b',
    defaultTimeoutMs: 60000,
    env: { baseUrl: 'GROQ_URL', model: 'GROQ_MODEL', timeoutMs: 'GROQ_TIMEOUT_MS' },
    buildRequest({ baseUrl, model, apiKey, messages }) {
      return {
        url: `${baseUrl}/chat/completions`,
        headers: { Authorization: `Bearer ${apiKey}` },
        body: {
          model,
          messages,
          temperature: 0,
          stream: false,
          // Groq admite JSON mode; el contenido se valida contra OUTPUT_SCHEMA.
          response_format: { type: 'json_object' },
        },
      };
    },
    extractContent(payload) {
      return payload?.choices?.[0]?.message?.content;
    },
  },
};

export const PROVIDER_NAMES = Object.keys(PROVIDERS);

/** Error controlado del proveedor generativo; el servidor lo traduce a HTTP. */
export class GenerativeError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'GenerativeError';
    this.code = code;
    this.status = status;
  }
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function trimUrl(url) {
  return url.replace(/\/+$/, '');
}

/**
 * Configuración del proveedor activo. Se lee en cada llamada para facilitar
 * pruebas y cambios de entorno. El proveedor se elige con GENERATIVE_PROVIDER.
 */
export function getGenerativeConfig(env = process.env) {
  const name = String(env.GENERATIVE_PROVIDER ?? 'ollama').trim().toLowerCase() || 'ollama';
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new GenerativeError(
      'GENERATIVE_NOT_CONFIGURED',
      `GENERATIVE_PROVIDER debe ser ${PROVIDER_NAMES.join(' o ')}.`,
      503,
    );
  }

  return {
    provider: name,
    label: provider.label,
    baseUrl: trimUrl(env[provider.env.baseUrl] || provider.defaultBaseUrl),
    model: env[provider.env.model] || provider.defaultModel,
    timeoutMs: positiveNumber(env[provider.env.timeoutMs], provider.defaultTimeoutMs),
    apiKey: provider.apiKeyEnv ? String(env[provider.apiKeyEnv] ?? '').trim() : null,
    apiKeyEnv: provider.apiKeyEnv ?? null,
    requiresApiKey: provider.requiresApiKey,
  };
}

const MAX_RATE_LIMIT_RETRIES = 3;

/** Espera ante HTTP 429, respetando Retry-After cuando el proveedor lo envía. */
function rateLimitDelayMs(response, attempt) {
  const header = response.headers?.get?.('retry-after');
  const seconds = header != null && header !== '' ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60000);
  return Math.min(5000 * 2 ** attempt, 30000);
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
 * Resuelve proveedor y parámetros para una llamada. Las opciones explícitas
 * (usadas en pruebas) tienen prioridad sobre el entorno.
 */
function resolveTarget(options) {
  const config = getGenerativeConfig();
  const name = String(options.provider ?? config.provider).trim().toLowerCase();
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new GenerativeError(
      'GENERATIVE_NOT_CONFIGURED',
      `Proveedor desconocido: ${name}. Use ${PROVIDER_NAMES.join(' o ')}.`,
      503,
    );
  }

  if (name === config.provider) {
    return {
      name,
      provider,
      baseUrl: trimUrl(options.baseUrl ?? config.baseUrl),
      model: options.model ?? config.model,
      timeoutMs: positiveNumber(options.timeoutMs ?? config.timeoutMs, provider.defaultTimeoutMs),
      apiKey: options.apiKey ?? config.apiKey,
    };
  }

  return {
    name,
    provider,
    baseUrl: trimUrl(options.baseUrl ?? provider.defaultBaseUrl),
    model: options.model ?? provider.defaultModel,
    timeoutMs: positiveNumber(options.timeoutMs, provider.defaultTimeoutMs),
    apiKey: options.apiKey ?? (provider.apiKeyEnv ? String(process.env[provider.apiKeyEnv] ?? '').trim() : null),
  };
}

/**
 * Clasifica una solicitud con un modelo generativo (Ollama local o Groq en la
 * nube). El mensaje del usuario viaja como rol "user", nunca concatenado al
 * prompt de sistema, y la salida se valida contra el contrato común.
 */
export async function analyzeGenerative(message, options = {}) {
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    throw new TypeError(`El mensaje debe ser un texto de entre 1 y ${MAX_MESSAGE_LENGTH} caracteres y no estar vacío.`);
  }

  const target = resolveTarget(options);
  const { provider } = target;

  if (provider.requiresApiKey && !target.apiKey) {
    throw new GenerativeError(
      'GENERATIVE_NOT_CONFIGURED',
      `Falta ${provider.apiKeyEnv} para usar ${provider.label}. Defina la API key en .env.`,
      503,
    );
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const request = provider.buildRequest({
    baseUrl: target.baseUrl,
    model: target.model,
    apiKey: target.apiKey,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
  });

  let response;
  for (let attempt = 0; ; attempt += 1) {
    try {
      response = await fetchImpl(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...request.headers },
        body: JSON.stringify(request.body),
        signal: AbortSignal.timeout(target.timeoutMs),
      });
    } catch (error) {
      if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
        throw new GenerativeError('GENERATIVE_TIMEOUT', `${provider.label} no respondió en ${target.timeoutMs} ms.`, 504);
      }
      throw new GenerativeError('GENERATIVE_UNAVAILABLE', `No se pudo conectar con ${provider.label}.`, 503);
    }

    // Los proveedores en la nube limitan la tasa de peticiones: se reintenta 429.
    if (response.status !== 429 || attempt >= MAX_RATE_LIMIT_RETRIES) break;
    await new Promise((resolve) => setTimeout(resolve, rateLimitDelayMs(response, attempt)));
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

  const content = provider.extractContent(payload);
  if (typeof content !== 'string' || !content.trim()) {
    throw new GenerativeError('GENERATIVE_INVALID_OUTPUT', `La respuesta de ${provider.label} no contiene el texto del modelo.`, 502);
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
