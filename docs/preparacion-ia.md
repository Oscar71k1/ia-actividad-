# Motor generativo: Ollama y Groq

Estado: **implementado y conectado a proveedores reales**. No se usan respuestas escritas manualmente como sustituto del modelo.

## Proveedores y modelos

Se admiten dos proveedores, seleccionados con `GENERATIVE_PROVIDER`:

| Valor | Proveedor | Modelo por defecto | Requisitos |
| --- | --- | --- | --- |
| `ollama` | Ollama local | `qwen2.5:3b` | Instalar Ollama y descargar el modelo |
| `groq` | Groq en la nube | `openai/gpt-oss-120b` | API key de <https://console.groq.com/keys> |

Ollama es el valor por defecto porque funciona sin claves ni conexión. Groq evita instalar modelos y suele responder en segundos, pero envía los mensajes fuera del equipo y depende de los límites del plan contratado.

La URL y el timeout de cada proveedor se configuran por separado: `OLLAMA_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS` y `GROQ_URL`, `GROQ_MODEL`, `GROQ_TIMEOUT_MS`.

## Flujo de integración

1. `src/generative.mjs` lee `prompts/support-system.txt` como prompt de sistema.
2. Elige el adaptador según `GENERATIVE_PROVIDER`. Cada adaptador define URL, cabeceras, cuerpo y cómo extraer el texto de la respuesta.
3. **Ollama:** `POST {OLLAMA_URL}/api/chat` con `model`, `stream: false`, `format` (esquema JSON del contrato) y `temperature: 0`.
4. **Groq:** `POST {GROQ_URL}/chat/completions` (compatible con OpenAI) con `Authorization: Bearer`, `response_format: { type: "json_object" }` y `temperature: 0`.
5. El mensaje del usuario viaja en un mensaje de rol `user`, **nunca concatenado** al prompt de sistema.
6. El texto devuelto se interpreta como JSON y se valida con `src/contract.mjs`.
7. Devuelve `category`, `priority`, `response`, `requiresHumanReview` y `mode`.

## Validación y seguridad

- Se comprueban campos, tipos y valores permitidos.
- `response` debe ser un texto no vacío y de máximo 4000 caracteres.
- Si la categoría es `SECURITY`, se fuerza `requiresHumanReview: true`.
- El servidor fija `mode: "generative"`; no confía en el valor devuelto por el modelo.
- Los errores del proveedor se traducen a HTTP 502, 503 o 504 con códigos estables.
- Si falta la API key de Groq, la API responde 503 con `GENERATIVE_NOT_CONFIGURED`.
- Los HTTP 429 se reintentan hasta 3 veces, respetando `Retry-After`, antes de devolver error.
- Nunca se devuelve el cuerpo de error del proveedor, para no filtrar información interna.
- No se registran los mensajes de los usuarios ni se almacenan solicitudes.
- `.env` está ignorado por git y no hay credenciales en el repositorio.

## Cómo ejecutar

Con Ollama:

```sh
ollama pull qwen2.5:3b
npm start
npm run examples:generative
npm run compare
```

Con Groq, defina en `.env`:

```sh
GENERATIVE_PROVIDER=groq
GROQ_API_KEY=su-clave
```

y ejecute los mismos comandos (`npm start`, `npm run examples:generative`, `npm run compare`).

`npm test` no requiere ningún proveedor: usa servidores HTTP falsos para comprobar ambos adaptadores, los timeouts y las respuestas inválidas.

## Comparación

`fixtures/support-cases.json` define 15 solicitudes con su clasificación de referencia: normales, ambiguas, adversariales y variantes de seguridad. `scripts/compare.mjs` ejecuta ambos motores, calcula el porcentaje de acierto (categoría y prioridad), registra formato y revisión humana, y escribe `evidence/comparison.json` y `evidence/comparison.md`. Un fallo del proveedor cuenta como caso no acertado.

## Limitaciones

Un modelo local puede tardar decenas de segundos por solicitud en CPU. Un proveedor en la nube añade dependencia de red, cuota y privacidad: los mensajes salen del equipo. La separación de roles y la validación reducen el riesgo de inyección de instrucciones, pero no lo eliminan. Los 15 casos son una prueba funcional, no una medida de precisión general.
