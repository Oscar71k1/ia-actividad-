# Motor generativo con Ollama

Estado: **implementado y conectado a un proveedor local real**. No se usan respuestas escritas manualmente como sustituto del modelo.

## Proveedor y modelo

Se eligió **Ollama** por ser local, gratuito y no requerir claves. El modelo por defecto es `qwen2.5:3b`; se puede cambiar con `OLLAMA_MODEL` (por ejemplo, `qwen2.5:1.5b` en equipos con poca memoria). La URL y el timeout se configuran con `OLLAMA_URL` y `OLLAMA_TIMEOUT_MS`.

## Flujo de integración

1. `src/generative.mjs` lee `prompts/support-system.txt` como prompt de sistema.
2. Envía `POST {OLLAMA_URL}/api/chat` con `model`, `stream: false`, `format` (esquema JSON del contrato) y `temperature: 0`.
3. El mensaje del usuario viaja en un mensaje de rol `user`, **nunca concatenado** al prompt de sistema.
4. Interpreta `message.content` como JSON y lo valida con `src/contract.mjs`.
5. Devuelve `category`, `priority`, `response`, `requiresHumanReview` y `mode`.

## Validación y seguridad

- Se comprueban campos, tipos y valores permitidos.
- `response` debe ser un texto no vacío y de máximo 4000 caracteres.
- Si la categoría es `SECURITY`, se fuerza `requiresHumanReview: true`.
- El servidor fija `mode: "generative"`; no confía en el valor devuelto por el modelo.
- Los errores del proveedor se traducen a HTTP 502, 503 o 504 con códigos estables.
- Nunca se devuelve el cuerpo de error del proveedor, para no filtrar información interna.
- No se registran los mensajes de los usuarios ni se almacenan solicitudes.
- `.env` está ignorado por git y no hay credenciales en el repositorio.

## Cómo ejecutar

```sh
ollama pull qwen2.5:3b
npm start
npm run examples:generative
npm run compare
```

`npm test` no requiere Ollama: usa servidores HTTP falsos para comprobar la integración, los timeouts y las respuestas inválidas.

## Comparación

`fixtures/support-cases.json` define 15 solicitudes con su clasificación de referencia: normales, ambiguas, adversariales y variantes de seguridad. `scripts/compare.mjs` ejecuta ambos motores, calcula el porcentaje de acierto (categoría y prioridad), registra formato y revisión humana, y escribe `evidence/comparison.json` y `evidence/comparison.md`. Un fallo del proveedor cuenta como caso no acertado.

## Limitaciones

El modelo local puede tardar decenas de segundos por solicitud en CPU. La separación de roles y la validación reducen el riesgo de inyección de instrucciones, pero no lo eliminan. Los 15 casos son una prueba funcional, no una medida de precisión general.
