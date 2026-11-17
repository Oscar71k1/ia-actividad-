export const CATEGORIES = ['ACCESS', 'BUG', 'FEATURE', 'SECURITY'];
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const MODES = ['traditional', 'generative'];
export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_RESPONSE_LENGTH = 4000;

/** Error de validación de la petición (HTTP 400). */
export class RequestError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RequestError';
    this.status = 400;
  }
}

/** Error de validación de la salida de un motor (HTTP 502). */
export class ModelOutputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ModelOutputError';
    this.status = 502;
  }
}

/**
 * Valida el cuerpo de POST /api/analyze y devuelve solo los campos permitidos.
 * No acepta arreglos, nulos ni mensajes vacíos.
 */
export function parseAnalyzeRequest(data) {
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new RequestError('El cuerpo debe ser un objeto JSON.');
  }
  if (typeof data.message !== 'string' || !data.message.trim()) {
    throw new RequestError('message debe ser un texto no vacío.');
  }
  if (data.message.length > MAX_MESSAGE_LENGTH) {
    throw new RequestError(`message no puede superar ${MAX_MESSAGE_LENGTH} caracteres.`);
  }
  if (!MODES.includes(data.mode)) {
    throw new RequestError('mode debe ser traditional o generative.');
  }
  return { message: data.message, mode: data.mode };
}

/**
 * Comprueba que un resultado cumpla el contrato común y normaliza sus campos.
 * Por seguridad, un resultado SECURITY siempre exige revisión humana, aunque
 * el modelo haya devuelto false. El modo lo fija el servidor, no el modelo.
 */
export function validateAnalysis(value, { mode } = {}) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new ModelOutputError('La salida del motor debe ser un objeto JSON.');
  }
  if (!CATEGORIES.includes(value.category)) {
    throw new ModelOutputError('category debe ser ACCESS, BUG, FEATURE o SECURITY.');
  }
  if (!PRIORITIES.includes(value.priority)) {
    throw new ModelOutputError('priority debe ser LOW, MEDIUM, HIGH o CRITICAL.');
  }
  if (typeof value.response !== 'string' || !value.response.trim()) {
    throw new ModelOutputError('response debe ser un texto no vacío.');
  }
  if (value.response.length > MAX_RESPONSE_LENGTH) {
    throw new ModelOutputError(`response no puede superar ${MAX_RESPONSE_LENGTH} caracteres.`);
  }
  if (typeof value.requiresHumanReview !== 'boolean') {
    throw new ModelOutputError('requiresHumanReview debe ser booleano.');
  }

  return {
    category: value.category,
    priority: value.priority,
    response: value.response.trim(),
    requiresHumanReview: value.category === 'SECURITY' ? true : value.requiresHumanReview,
    mode: mode ?? value.mode,
  };
}

/** Indica si un resultado cumple el formato, sin lanzar excepciones. */
export function isValidAnalysis(value, options) {
  try {
    validateAnalysis(value, options);
    return true;
  } catch {
    return false;
  }
}
