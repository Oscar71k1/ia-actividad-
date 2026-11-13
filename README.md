# AI Support Engine

Prototipo funcional del reto práctico de clasificación inteligente de solicitudes de soporte. Implementa dos motores con el mismo contrato de respuesta:

- **Traditional:** reglas y palabras clave, sin modelos generativos.
- **Generative:** modelo real, local con [Ollama](https://ollama.com/) o en la nube con [Groq](https://console.groq.com/), con salida JSON validada.

Ambos se exponen mediante `POST /api/analyze`.

## Requisitos

- Node.js 22 o superior.
- Un proveedor para el motor generativo: Ollama local o una clave de Groq. El motor tradicional funciona sin proveedor.
- No se requieren paquetes npm.

## Puesta en marcha

### 1. Motor tradicional y pruebas

```sh
npm run examples
npm test
```

`npm test` no necesita proveedor: las pruebas del motor generativo usan servidores HTTP falsos para verificar Ollama y Groq, timeouts, errores y formatos inválidos. La evidencia real del modelo se genera aparte, con `npm run compare` o `npm run evidence`.

### 2. Elegir el proveedor generativo

El proveedor se selecciona con `GENERATIVE_PROVIDER`: `ollama` (por defecto) o `groq`.

#### Opción A: Ollama (local)

1. Instale Ollama desde <https://ollama.com/download>.
2. Descargue un modelo. El valor por defecto del proyecto es `qwen2.5:3b`:

```sh
ollama pull qwen2.5:3b
```

3. Verifique que el servicio local responda:

```sh
ollama list
```

En Windows, la aplicación de Ollama deja el servicio activo en `http://127.0.0.1:11434`. Si no está activo, ejecute `ollama serve` en otra terminal.

Si el equipo tiene poca memoria o el modelo responde lento, use `qwen2.5:1.5b` y ajuste la variable de entorno.

#### Opción B: Groq (nube)

1. Cree una API key en <https://console.groq.com/keys>.
2. Defina `GENERATIVE_PROVIDER=groq` y `GROQ_API_KEY` en `.env`.
3. El modelo por defecto es `openai/gpt-oss-120b`; puede cambiarlo con `GROQ_MODEL`. Verifique los modelos disponibles de su cuenta con `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`, porque Groq retira modelos periódicamente.

Groq no requiere instalar nada y suele responder en segundos, pero **los mensajes salen del equipo** y la cuenta está sujeta a los límites del plan gratuito. Nunca guarde la clave en el repositorio: `.env` está ignorado por git.

### 3. Configuración

Copie `.env.example` como `.env` o defina variables en la terminal:

```powershell
$env:GENERATIVE_PROVIDER = 'groq'
$env:GROQ_API_KEY = 'su-clave'
$env:GROQ_MODEL = 'openai/gpt-oss-120b'
```

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `GENERATIVE_PROVIDER` | `ollama` | Proveedor: `ollama` o `groq` |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | URL del proveedor local |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Modelo de Ollama |
| `OLLAMA_TIMEOUT_MS` | `120000` | Tiempo máximo por solicitud |
| `GROQ_API_KEY` | — | Clave de Groq; solo en `.env` |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Modelo de Groq |
| `GROQ_URL` | `https://api.groq.com/openai/v1` | Endpoint compatible con OpenAI |
| `GROQ_TIMEOUT_MS` | `60000` | Tiempo máximo por solicitud |
| `PORT` | `3000` | Puerto de la API |

`.env` está ignorado por git. No se almacenan claves ni credenciales en el repositorio.

## API local

Inicie el servidor:

```sh
npm start
```

En otra terminal de PowerShell:

```powershell
# Motor tradicional
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/analyze -Method Post -ContentType 'application/json' -Body '{"message":"No puedo iniciar sesión","mode":"traditional"}'

# Motor generativo
$body = @{ message = 'No puedo iniciar sesión'; mode = 'generative' } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/analyze -Method Post -ContentType 'application/json' -Body $body
```

El servidor escucha solo en `127.0.0.1`. No almacena solicitudes ni escribe los mensajes en registros.

### Contrato de respuesta

```json
{
  "category": "ACCESS",
  "priority": "MEDIUM",
  "response": "Lamentamos el inconveniente. Verifique sus credenciales...",
  "requiresHumanReview": false,
  "mode": "generative"
}
```

- `category`: `ACCESS`, `BUG`, `FEATURE` o `SECURITY`.
- `priority`: `LOW`, `MEDIUM`, `HIGH` o `CRITICAL`.
- `response`: texto no vacío.
- `requiresHumanReview`: booleano. Siempre es `true` para `SECURITY`.
- `mode`: `traditional` o `generative`, fijado por el servidor.

### Errores

| Situación | HTTP | Código |
| --- | ---: | --- |
| JSON inválido o campos fuera de rango | 400 | — |
| Ruta inexistente | 404 | — |
| Método distinto de POST | 405 | — (incluye `Allow: POST`) |
| Cuerpo mayor a 32 KiB | 413 | — |
| `Content-Type` distinto de JSON | 415 | — |
| Proveedor sin configurar (falta la API key) | 503 | `GENERATIVE_NOT_CONFIGURED` |
| Proveedor generativo no disponible | 503 | `GENERATIVE_UNAVAILABLE` |
| Tiempo de espera agotado | 504 | `GENERATIVE_TIMEOUT` |
| Error HTTP del proveedor | 502 | `GENERATIVE_PROVIDER_ERROR` |
| Respuesta del modelo ausente o inválida | 502 | `GENERATIVE_INVALID_OUTPUT` |

Los detalles internos del proveedor no se incluyen en las respuestas para no filtrar información sensible.

## Motor tradicional

Reglas evaluadas en orden; seguridad tiene preferencia:

| Categoría | Ejemplos de coincidencias | Prioridad base |
| --- | --- | --- |
| SECURITY | vulnerabilidad, phishing, hackeo, contraseña expuesta, robo de datos, brecha de seguridad | HIGH |
| FEATURE | agregar, nueva funcionalidad, me gustaría, sería útil | LOW |
| ACCESS | iniciar sesión, contraseña, cuenta bloqueada, recuperar cuenta | MEDIUM |
| BUG | error, falla, no funciona, se cierra, se congela, no carga | MEDIUM |

- Se ignoran mayúsculas y acentos.
- Seguridad siempre requiere revisión humana.
- Robo de datos, exposición de credenciales o datos, ransomware, filtración activa y brecha de datos elevan a `CRITICAL`.
- Fallas o accesos con «todos los usuarios», «toda la empresa», «producción» o «urgente» reciben `HIGH`.
- Sin coincidencias se devuelve `BUG` provisional, `MEDIUM` y revisión humana.
- Cada categoría tiene una respuesta predeterminada; no se ejecuta ninguna acción real.

## Motor generativo

- El prompt de sistema está en `prompts/support-system.txt`.
- El mensaje del usuario se envía como rol `user`, separado del prompt de sistema, para reducir el riesgo de inyección de instrucciones.
- Los proveedores están aislados en adaptadores dentro de `src/generative.mjs`; el flujo de validación es común.
- **Ollama:** `POST /api/chat` con `stream: false`, un esquema JSON (`format`) y `temperature: 0`.
- **Groq:** `POST /chat/completions` compatible con OpenAI, con `response_format: { type: 'json_object' }`, `temperature: 0` y autenticación `Bearer`.
- La salida se parsea como JSON y se valida contra el contrato: categorías, prioridades, respuesta no vacía y booleano.
- Si el modelo clasifica como `SECURITY`, el servidor fuerza `requiresHumanReview: true` aunque el modelo haya devuelto `false`.
- `mode` lo fija el servidor, no el modelo.
- Timeout configurable, errores del proveedor controlados y sin respuestas simuladas.
- Los límites de tasa (HTTP 429) se reintentan hasta 3 veces, respetando `Retry-After`.

## Pruebas comparativas

`fixtures/support-cases.json` contiene **15 solicitudes**: normales, ambiguas, adversariales y variantes de seguridad. La clasificación de referencia se definió antes de ejecutar la comparación.

Ejecute ambos motores sobre todos los casos:

```sh
npm run compare
```

El script escribe `evidence/comparison.json` y `evidence/comparison.md` con categoría, prioridad, formato, revisión humana, acierto y tiempo por caso. El porcentaje de acierto exige coincidir en categoría y prioridad; un error del proveedor cuenta como caso no acertado.

Para regenerar todas las evidencias (pruebas, API y comparación):

```sh
npm run evidence
```

Las llamadas al proveedor se espacian con `EVIDENCE_DELAY_MS` (3000 ms por defecto) para respetar los límites de tasa de la nube.

## Resultados de la comparación

Ejecución con Groq (`openai/gpt-oss-120b`):

| Motor | Aciertos | Formato válido | Revisión humana correcta |
| --- | ---: | ---: | ---: |
| Tradicional | 15/15 (100%) | 15/15 (100%) | 15/15 (100%) |
| Generativo | 14/15 (93.3%) | 15/15 (100%) | 15/15 (100%) |

El único fallo de esa ejecución fue C12: se esperaba `SECURITY / HIGH` y el modelo devolvió `SECURITY / CRITICAL`. En ejecuciones repetidas el generativo obtuvo 12 y 14 aciertos de 15; con `temperature: 0` la salida sigue sin ser determinista. Los fallos se concentran en la prioridad de casos ambiguos, no en el formato ni en la revisión humana.

La evidencia HTTP (`evidence/api.json`) se recolectó en una ejecución posterior y obtuvo 12/15 para el generativo, coherente con esa variabilidad. El motor tradicional acierta porque sus reglas se ajustaron junto con los 15 casos; el generativo no vio las respuestas esperadas.

La comparación completa está en `evidence/comparison.md` y `evidence/comparison.json`.

## Evidencias

- `evidence/tests.txt`: salida completa de las pruebas automatizadas.
- `evidence/api.json`: peticiones y respuestas HTTP reales para ambos motores y validaciones.
- `evidence/comparison.md`: tabla comparativa y porcentajes.
- `evidence/comparison.json`: resultados completos por caso, incluidos errores y tiempos.
- `evidence/examples.txt`: ejemplos del motor tradicional.

Cada archivo incluye fecha UTC, commit evaluado y versión de Node. La comparación registra el proveedor y el modelo exactos.

## Alcance y limitaciones

- El motor tradicional no comprende contexto: puede fallar con negaciones, sinónimos no previstos o mensajes que mezclan asuntos. La detección de seguridad es básica.
- El motor generativo depende de la calidad del modelo elegido y, en local, del hardware. En CPU puede tardar decenas de segundos por solicitud.
- Con Groq u otro proveedor en la nube, los mensajes salen del equipo y quedan sujetos a la política y a los límites del proveedor.
- La separación de roles y la validación reducen, pero no eliminan, el riesgo de inyección de instrucciones o de clasificaciones erróneas.
- El conjunto de 15 casos es una prueba funcional, no una medición estadística de precisión general.
