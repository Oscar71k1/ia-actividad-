import { MAX_MESSAGE_LENGTH } from './contract.mjs';

// Las reglas se evalúan en orden: seguridad siempre tiene preferencia.
// El texto se normaliza sin acentos y en minúsculas antes de comparar.
const RULES = [
  {
    category: 'SECURITY',
    pattern: /\b(vulnerabilidad(?:es)?|hackeo|hackeado|hackeada|hackeados|hackeadas|hackear|hackearon|hackeando|phishing|malware|ransomware|filtracion(?:es)?|robo de (?:datos|informacion|credenciales)|robaron (?:mis |los |nuestros )?(?:datos|informacion|credenciales|cuenta)|datos (?:esta |estan |fue |fueron |han sido )?expuestos|informacion (?:esta |estan |fue |fueron |han sido )?expuesta|contrasenas? (?:esta |estan |fue |fueron |han sido )?expuestas?|credenciales (?:esta |estan |fue |fueron |han sido )?expuestas|acceso no autorizado|acceso indebido|brecha (?:de )?(?:datos|seguridad)|incidente de seguridad|cuenta comprometida|sistema comprometido|exposicion de datos|entraron sin permiso)\b/,
    priority: 'HIGH',
    response: 'Gracias por reportar este posible incidente de seguridad. Evite compartir contraseñas o datos sensibles. El caso requiere revisión del equipo de seguridad.',
  },
  {
    category: 'FEATURE',
    pattern: /\b(agregar|anadir|incorporar|implementar|nueva funcionalidad|nuevas funcionalidades|nueva funcion|me gustaria|seria util)\b/,
    priority: 'LOW',
    response: 'Gracias por su sugerencia. Describa cómo utilizaría esta funcionalidad y qué necesidad resolvería para facilitar su evaluación.',
  },
  {
    category: 'ACCESS',
    pattern: /\b(iniciar sesion|inicio de sesion|inicios de sesion|ingresar|entrar|acceder|login|contrasena|credenciales|cuenta bloqueada|recuperar cuenta)\b/,
    priority: 'MEDIUM',
    response: 'Lamentamos el inconveniente de acceso. Verifique sus credenciales y utilice la recuperación de contraseña si es necesario. Nunca comparta su contraseña.',
  },
  {
    category: 'BUG',
    pattern: /\b(error(?:es)?|falla(?:s)?|fallo(?:s)?|no funciona|se cierra|se congela|pantalla en blanco|no carga|caido|caida)\b/,
    priority: 'MEDIUM',
    response: 'Lamentamos la falla. Indique los pasos para reproducirla y el mensaje de error, evitando incluir información sensible.',
  },
];

const CRITICAL_SECURITY = /\b(robo de (?:datos|informacion|credenciales)|robaron (?:mis |los |nuestros )?(?:datos|informacion|credenciales)|datos (?:esta |estan |fue |fueron |han sido )?expuestos|informacion (?:esta |estan |fue |fueron |han sido )?expuesta|contrasenas? (?:esta |estan |fue |fueron |han sido )?expuestas?|credenciales (?:esta |estan |fue |fueron |han sido )?expuestas|ransomware|filtracion activa|brecha de datos|exposicion de datos)\b/;
const HIGH_IMPACT = /\b(urgente|todos los usuarios|toda la empresa|produccion|bloquea el trabajo)\b/;

/** Clasifica un mensaje sin usar modelos generativos ni servicios externos. */
export function analyzeTraditional(message) {
  if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
    throw new TypeError(`El mensaje debe ser un texto de entre 1 y ${MAX_MESSAGE_LENGTH} caracteres y no estar vacío.`);
  }

  const text = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const rule = RULES.find(({ pattern }) => pattern.test(text));

  // El contrato exige una categoría. Los mensajes sin coincidencias se derivan
  // a revisión humana como BUG provisional; no se presentan como certeza.
  if (!rule) {
    return {
      category: 'BUG',
      priority: 'MEDIUM',
      response: 'Necesitamos más información para clasificar su solicitud. Describa qué intentaba hacer y qué ocurrió. El caso requiere revisión humana.',
      requiresHumanReview: true,
      mode: 'traditional',
    };
  }

  let priority = rule.priority;
  if (rule.category === 'SECURITY' && CRITICAL_SECURITY.test(text)) {
    priority = 'CRITICAL';
  } else if (['ACCESS', 'BUG'].includes(rule.category) && HIGH_IMPACT.test(text)) {
    priority = 'HIGH';
  }

  return {
    category: rule.category,
    priority,
    response: rule.response,
    requiresHumanReview: rule.category === 'SECURITY',
    mode: 'traditional',
  };
}
