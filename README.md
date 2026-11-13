# AI Support Engine

Prototipo funcional del reto práctico de clasificación inteligente de solicitudes de soporte. Implementa dos motores con el mismo contrato de respuesta:

- **Traditional:** reglas y palabras clave, sin modelos generativos.
- **Generative:** modelo real servido localmente por [Ollama](https://ollama.com/), con salida JSON validada.

Ambos se exponen mediante `POST /api/analyze`.

## Requisitos

- Node.js 22 o superior.
- Ollama para el motor generativo. El motor tradicional funciona sin Ollama.
- No se requieren paquetes npm ni claves de API.

## Puesta en marcha

### 1. Motor tradicional y pruebas

```sh
npm run examples
npm test
```

`npm test` no necesita Ollama: las pruebas del proveedor usan servidores HTTP falsos para verificar timeouts, errores y formatos inválidos. La evidencia real del modelo se genera aparte, con `npm run compare` o `npm run evidence`.

### 2. Instalar y preparar Ollama

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

### 3. Configuración opcional

Copie `.env.example` como `.env` o defina variables en la terminal:

```powershell
$env:OLLAMA_MODEL = 'qwen2.5:3b'
$env:OLLAMA_URL = 'http://127.0.0.1:11434'
$env:OLLAMA_TIMEOUT_MS = '180000'
```

| Variable | Valor por defecto | Uso |
| --- | --- | --- |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | URL del proveedor local |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Modelo de Ollama |
| `OLLAMA_TIMEOUT_MS` | `120000` | Tiempo máximo por solicitud |
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
- La llamada usa `POST /api/chat` de Ollama con `stream: false`, un esquema JSON (`format`) y `temperature: 0`.
- La salida se parsea como JSON y se valida contra el contrato: categorías, prioridades, respuesta no vacía y booleano.
- Si el modelo clasifica como `SECURITY`, el servidor fuerza `requiresHumanReview: true` aunque el modelo haya devuelto `false`.
- `mode` lo fija el servidor, no el modelo.
- Timeout configurable, errores del proveedor controlados y sin respuestas simuladas.

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

## Resultados de la comparación

`npm run compare` genera la tabla definitiva en `evidence/comparison.md`. En la última ejecución, sin Ollama disponible, el motor tradicional obtuvo **15/15 (100%)** y el motor generativo registró `GENERATIVE_UNAVAILABLE` en los 15 casos. Ese 0% no mide la calidad del modelo: mide que el proveedor no estaba activo. Ejecute `npm run evidence` con Ollama para obtener la comparación final.

La conclusión técnica se actualizará con los resultados reales de ambos motores.

## Evidencias

- `evidence/tests.txt`: salida completa de las pruebas automatizadas.
- `evidence/api.json`: peticiones y respuestas HTTP reales para ambos motores y validaciones.
- `evidence/comparison.md`: tabla comparativa y porcentajes.
- `evidence/comparison.json`: resultados completos por caso, incluidos errores y tiempos.
- `evidence/examples.txt`: ejemplos del motor tradicional.

Cada archivo incluye fecha UTC, commit evaluado y versión de Node. La comparación registra el modelo exacto usado.

## Alcance y limitaciones

- El motor tradicional no comprende contexto: puede fallar con negaciones, sinónimos no previstos o mensajes que mezclan asuntos. La detección de seguridad es básica.
- El motor generativo depende de la calidad del modelo local y del hardware. En CPU puede tardar decenas de segundos por solicitud.
- La separación de roles y la validación reducen, pero no eliminan, el riesgo de inyección de instrucciones o de clasificaciones erróneas.
- El conjunto de 15 casos es una prueba funcional, no una medición estadística de precisión general.
