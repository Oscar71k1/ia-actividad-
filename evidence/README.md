# Evidencias

Archivos generados ejecutando el proyecto. No se usan respuestas generativas escritas manualmente ni simuladas.

- `tests.txt`: salida del ejecutor de pruebas; 29 pruebas aprobadas y 0 fallos.
- `examples.txt`: salida de los ejemplos del motor tradicional.
- `api.json`: peticiones y respuestas HTTP reales para ambos motores, además de las validaciones (400, 404, 405, 413, 415).
- `comparison.json`: resultados completos por caso y motor, con errores y tiempos.
- `comparison.md`: tabla comparativa y porcentajes.

## Cómo regenerar

```sh
npm run evidence
```

Requiere un proveedor generativo configurado: Ollama local o Groq con `GROQ_API_KEY`. `npm test` no requiere proveedor: las pruebas usan servidores HTTP falsos para comprobar ambos adaptadores, timeouts, errores y respuestas inválidas. Las llamadas reales se espacian con `EVIDENCE_DELAY_MS` (3000 ms por defecto) para respetar los límites de tasa.

## Estado de la última captura

Proveedor: **Groq (`openai/gpt-oss-120b`)**.

- Motor tradicional: 15/15 casos de referencia (100%).
- Motor generativo: 14/15 (93.3%), formato válido 15/15 y revisión humana correcta 15/15.
- El único fallo de `comparison.json` fue C12: se esperaba `SECURITY / HIGH` y el modelo devolvió `SECURITY / CRITICAL`.
- La captura HTTP de `api.json` se hizo en una ejecución posterior y obtuvo 12/15 para el generativo (C04, C09 y C12), siempre por prioridad. Con `temperature: 0` la salida del modelo no es determinista.
- Un fallo del proveedor cuenta como caso no acertado, según la metodología acordada, y no se sustituye por una respuesta inventada.

Cada archivo incluye fecha UTC, commit evaluado y versión de Node. La comparación registra el proveedor y el modelo exactos.

## Metodología

- Acierto: coincidencia de categoría y prioridad con la clasificación de referencia definida en `fixtures/support-cases.json`.
- Formato: categoría y prioridad válidas, respuesta no vacía y `requiresHumanReview` booleano.
- Revisión humana: se registra por separado si coincide con la referencia.
- Porcentaje: aciertos / total de casos × 100 por motor.
- Los 15 casos son una prueba funcional, no una medida estadística de precisión general.
