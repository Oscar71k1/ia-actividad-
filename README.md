# AI Support Engine

Proyecto del reto práctico de clasificación inteligente de solicitudes de soporte.

## Integrantes

- Oscar Flores Cerqueda
- Oscar Yael Hernandez Rodriguez

También disponibles en [integrantes.txt](integrantes.txt).

## Estado del proyecto

Se implementarán dos motores: uno basado en reglas y otro con inteligencia artificial generativa, disponibles mediante una API.

Estado: primer avance con API y motor tradicional funcionales. Incluye preparación del motor generativo y diez casos de referencia; la integración generativa real está pendiente.

## Ejecutar este avance

Requiere Node.js 22 o superior. No necesita dependencias, claves ni conexión a Internet.

```sh
npm run examples
npm test
```

## API local

Ejecute `npm start` y use otra terminal de PowerShell:

```powershell
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/analyze -Method Post -ContentType 'application/json' -Body '{"message":"No puedo iniciar sesión","mode":"traditional"}'
```

El servidor escucha en localhost, puerto 3000 (configurable mediante `PORT`). Deténgalo con Ctrl+C. No necesita instalar paquetes.

`POST /api/analyze` recibe `message` y `mode`. Devuelve el contrato de la función con HTTP 200 para el motor tradicional. Estados de error: 400 para JSON o campos inválidos, 404 para ruta inexistente, 405 para método incorrecto, 413 para cuerpos mayores a 32 KiB, 415 para contenido distinto de JSON y 501 para el motor generativo pendiente. No almacena solicitudes.

## Preparación de IA y pruebas

Se eligió Ollama local para la futura integración. Consulte [el plan y la documentación oficial del proveedor](docs/preparacion-ia.md). El prompt está en `prompts/support-system.txt` y los diez casos con resultados esperados están en `fixtures/support-cases.json`.

`npm test` comprueba el motor y la API mediante un servidor HTTP real en un puerto temporal, incluyendo los diez casos, entradas inválidas y el estado pendiente del motor generativo. Estas comprobaciones no son evidencia de ejecución de IA generativa.

## Usar la función

```js
import { analyzeTraditional } from './src/traditional.mjs';

console.log(analyzeTraditional('No puedo iniciar sesión'));
// {
//   category: 'ACCESS',
//   priority: 'MEDIUM',
//   response: '...',
//   requiresHumanReview: false,
//   mode: 'traditional'
// }
```

La función recibe un texto no vacío de hasta 5000 caracteres. Rechaza entradas inválidas con `TypeError`; quien implemente la API debe convertir ese error en una respuesta HTTP adecuada.

## Reglas de este avance

| Categoría | Ejemplos de coincidencias | Prioridad base |
| --- | --- | --- |
| SECURITY | vulnerabilidad, phishing, acceso no autorizado | HIGH |
| FEATURE | agregar, nueva funcionalidad, me gustaría | LOW |
| ACCESS | iniciar sesión, contraseña, cuenta bloqueada | MEDIUM |
| BUG | error, no funciona, se cierra | MEDIUM |

Se ignoran mayúsculas y acentos. Gana la primera categoría coincidente en el orden de la tabla; seguridad tiene preferencia. Las solicitudes de funcionalidades se evalúan antes de acceso para reconocer, por ejemplo, «agregar inicio de sesión con huella».

- Seguridad siempre requiere revisión humana. Robo de datos, contraseñas expuestas, datos expuestos, ransomware o filtración activa elevan la prioridad a CRITICAL.
- Fallas o problemas de acceso con palabras de alto impacto, como «todos los usuarios» o «producción», reciben HIGH.
- Sin coincidencias se devuelve BUG provisional, MEDIUM y revisión humana, solicitando más información.
- Cada categoría tiene una respuesta predeterminada; no se realiza ninguna acción ni envío real a soporte.

## Alcance y limitaciones

Este motor usa palabras clave y no comprende el contexto completo: puede equivocarse con negaciones, sinónimos no previstos o mensajes que mezclan asuntos. La detección de seguridad es básica y no garantiza reconocer todos los incidentes. Los ejemplos y pruebas automáticas corresponden únicamente al motor tradicional; todavía no constituyen la comparación de ambos motores requerida para la entrega final.
