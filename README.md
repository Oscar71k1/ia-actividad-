# AI Support Engine

Proyecto del reto práctico de clasificación inteligente de solicitudes de soporte.

Se implementarán dos motores: uno basado en reglas y otro con inteligencia artificial generativa, disponibles mediante una API.

Estado: primer avance del motor tradicional. La API y el motor generativo están pendientes.

## Ejecutar este avance

Requiere Node.js 22 o superior. No necesita dependencias, claves ni conexión a Internet.

```sh
npm run examples
npm test
```

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
