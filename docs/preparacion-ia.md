# Preparación del motor generativo

Proveedor elegido para el siguiente avance: **Ollama local**. Permite conectar un modelo instalado en el equipo mediante HTTP. El modelo concreto se elegirá según la memoria disponible; todavía no se ha instalado ni ejecutado.

Referencia oficial: [API de chat de Ollama](https://docs.ollama.com/api/chat).

Plan de integración:

1. Instalar Ollama y descargar un modelo compatible con el equipo.
2. Configurar el nombre del modelo y la URL local del proveedor en el servidor.
3. Enviar `POST http://localhost:11434/api/chat` con `model`, `stream: false`, `format: "json"` y dos mensajes: uno de rol `system` con `prompts/support-system.txt` y otro de rol `user` con la solicitud original. No concatenar la solicitud dentro del prompt de sistema.
4. Interpretar `message.content` como JSON y validar campos, tipos y valores permitidos. Exigir revisión humana para posibles incidentes de seguridad; el prompt por sí solo no garantiza protección.
5. Manejar tiempo de espera, proveedor desconectado y respuestas inválidas sin exponer información sensible ni sustituirlas por respuestas simuladas.

## Casos de referencia

`fixtures/support-cases.json` define de antemano 10 solicitudes: normales, ambiguas y dos intentos de manipulación. Los casos ambiguos incluyen el criterio usado para decidir el resultado esperado.

En el siguiente avance se ejecutarán los mismos casos en ambos motores. Registrar categoría, prioridad, revisión humana, formato válido y acierto. Se contará como clasificación correcta la coincidencia de categoría y prioridad; el cumplimiento del formato y la revisión humana se registrarán por separado. Porcentaje = aciertos / 10 × 100 por motor. Un fallo del proveedor cuenta como caso no acertado, no se elimina del denominador.

Estado actual: preparación solamente. No hay resultados generativos ni comparación final; `mode: "generative"` devuelve HTTP 501.
