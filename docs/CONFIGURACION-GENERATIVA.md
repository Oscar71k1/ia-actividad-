# Configuración del motor generativo

El modo `generative` de `POST /api/analyze` usa un modelo real. No hay respuestas escritas a mano ni sustitutos simulados: si el proveedor falla, la API devuelve un error controlado.

## Proveedores y modelos

| Proveedor | Valor de `GENERATIVE_PROVIDER` | Modelo por defecto | Uso |
| --- | --- | --- | --- |
| Ollama (local) | `ollama` (por defecto) | `qwen2.5:3b` | Sin clave ni conexión externa; requiere instalar Ollama y descargar el modelo. |
| Groq (nube) | `groq` | `openai/gpt-oss-120b` | Sin instalación local; envía los mensajes fuera del equipo y depende de la cuota del plan. |

La evidencia real incluida en `evidence/` se capturó con **Groq y el modelo `openai/gpt-oss-120b`**. Verifique los modelos disponibles de su cuenta antes de fijar `GROQ_MODEL`, porque Groq retira modelos periódicamente:

```sh
curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
```

## Instalación

Requiere Node.js 22 o superior. No hay dependencias npm.

### Opción A: Ollama

1. Instale Ollama desde <https://ollama.com/download>.
2. Descargue el modelo:

```sh
ollama pull qwen2.5:3b
```

3. Compruebe que el servicio local responde con `ollama list`. En Windows suele estar activo en `http://127.0.0.1:11434`; si no, ejecute `ollama serve` en otra terminal. En equipos con poca memoria puede usar `qwen2.5:1.5b` y cambiar `OLLAMA_MODEL`.

### Opción B: Groq

1. Cree una clave en <https://console.groq.com/keys>.
2. Cree `.env` a partir de `.env.example` y defina `GENERATIVE_PROVIDER=groq` y `GROQ_API_KEY`. No suba `.env` al repositorio: está ignorado por git.

## Variables de entorno

El módulo `src/generative.mjs` carga automáticamente `.env` al importarse mediante `process.loadEnvFile` (disponible en Node 22). Si el archivo no existe o es inválido, se usan los valores por defecto. También puede definir las variables en la terminal; éstas tienen prioridad sobre `.env`.

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `GENERATIVE_PROVIDER` | `ollama` | `ollama` o `groq`. |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | URL base del servicio local. |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Modelo local. |
| `OLLAMA_TIMEOUT_MS` | `120000` | Tiempo máximo por solicitud. |
| `GROQ_API_KEY` | — | Clave de Groq; solo en `.env`. |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modelo de Groq. |
| `GROQ_URL` | `https://api.groq.com/openai/v1` | Endpoint compatible con OpenAI. |
| `GROQ_TIMEOUT_MS` | `60000` | Tiempo máximo por solicitud. |
| `PORT` | `3000` | Puerto de la API local. |
| `EVIDENCE_DELAY_MS` | `3000` | Espaciado entre llamadas al generar evidencias. |

`.env.example` contiene solo ejemplos. Nunca guarde la clave real en el repositorio ni en las evidencias.

## Arranque y comprobación

```sh
npm start
```

En otra terminal de PowerShell:

```powershell
$body = @{ message = 'No puedo iniciar sesión'; mode = 'generative' } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/analyze -Method Post -ContentType 'application/json' -Body $body
```

Respuesta esperada (el texto exacto lo genera el modelo cada vez):

```json
{
  "category": "ACCESS",
  "priority": "MEDIUM",
  "response": "Lamentamos el inconveniente. Verifique sus credenciales...",
  "requiresHumanReview": false,
  "mode": "generative"
}
```

El servidor escucha solo en `127.0.0.1` y no registra los mensajes de los usuarios.

Otros comandos útiles:

```sh
npm test                 # 29 pruebas, sin proveedor ni modelo instalado
npm run examples         # ejemplos del motor tradicional
npm run examples:generative  # una llamada real al modelo configurado
npm run compare          # compara ambos motores sobre los casos de referencia
npm run evidence         # regenera todas las evidencias (incluye llamadas reales)
```

Las pruebas automatizadas usan servidores HTTP falsos: no hacen llamadas de pago ni exigen un modelo instalado. Las evidencias sí requieren un proveedor configurado.

## Seguridad y validación

- El prompt de sistema está en `prompts/support-system.txt`; el mensaje del usuario viaja como rol `user`, nunca concatenado al prompt.
- La salida se parsea como JSON y se valida: categoría, prioridad, respuesta no vacía (máximo 4000 caracteres), booleano de revisión humana y modo fijado por el servidor.
- Si el modelo devuelve `SECURITY`, se fuerza `requiresHumanReview: true`.
- Además, `needsSecurityReview()` en `src/contract.mjs` examina el mensaje original buscando señales de incidentes de seguridad (robo de datos, credenciales expuestas, ransomware, etc.) y fuerza la revisión humana **incluso si el modelo fue engañado** y devolvió otra categoría. Esta comprobación no depende de que el modelo obedezca el prompt.
- Los errores del proveedor se traducen a HTTP 502/503/504 con códigos estables. No se devuelven claves, prompts internos, trazas ni el cuerpo de error del proveedor. Una llamada fallida nunca se sustituye por una respuesta inventada.

## Fallos frecuentes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `503 GENERATIVE_NOT_CONFIGURED` con `GROQ_API_KEY` | Falta la clave o `GENERATIVE_PROVIDER=groq` no está definido | Revise `.env` y reinicie el servidor. |
| `503 GENERATIVE_UNAVAILABLE` | Ollama no está activo o la URL es incorrecta | Ejecute `ollama serve` y compruebe `OLLAMA_URL`. |
| `504 GENERATIVE_TIMEOUT` | Modelo local lento en CPU o timeout demasiado bajo | Aumente `OLLAMA_TIMEOUT_MS` o use un modelo más pequeño. |
| `502 GENERATIVE_PROVIDER_ERROR` HTTP 429 | Límite de tasa del proveedor | El cliente reintenta hasta 3 veces; espere y reduzca la frecuencia (`EVIDENCE_DELAY_MS`). |
| `502 GENERATIVE_INVALID_OUTPUT` | El modelo devolvió texto libre o JSON fuera del contrato | No se acepta como éxito; revise el modelo o el prompt. No se inventa una respuesta. |
| `Model '...' not found` al arrancar | El modelo configurado no está descargado o Groq lo retiró | `ollama pull <modelo>` o ajuste `GROQ_MODEL`. |
| HTTP 403/401 de Groq | Clave inválida o sin cuota | Genere una clave nueva en la consola de Groq. |

Para reportar el proveedor y modelo utilizados, consulte el arranque del servidor: imprime `Motor generativo: <proveedor> <modelo> en <URL>`. Las evidencias también registran ambos valores.
