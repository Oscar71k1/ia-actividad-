# Evidencias

Archivos generados ejecutando el proyecto. No se usan respuestas generativas escritas manualmente ni simuladas.

- `tests.txt`: salida del ejecutor de pruebas; 23 pruebas aprobadas y 0 fallos.
- `examples.txt`: salida de los ejemplos del motor tradicional.
- `api.json`: peticiones y respuestas HTTP reales para ambos motores, además de las validaciones (400, 404, 405, 413, 415).
- `comparison.json`: resultados completos por caso y motor, con errores y tiempos.
- `comparison.md`: tabla comparativa y porcentajes.

## Cómo regenerar

```sh
npm run evidence
```

Requiere Ollama activo y el modelo configurado para el motor generativo. `npm test` no requiere Ollama: las pruebas del proveedor usan servidores HTTP falsos para comprobar timeouts, errores y formatos inválidos.

## Estado de la última captura

- Motor tradicional: 15/15 casos de referencia (100%).
- Motor generativo: pendiente de una ejecución con Ollama disponible. En la captura sin proveedor, los 15 casos registraron `GENERATIVE_UNAVAILABLE` (HTTP 503). Ese 0% **no mide la calidad del modelo**: mide que el proveedor no estaba instalado.
- Un fallo del proveedor cuenta como caso no acertado, según la metodología acordada, y no se sustituye por una respuesta inventada.

Cada archivo incluye fecha UTC, commit evaluado y versión de Node. La comparación registra el modelo exacto usado.

## Metodología

- Acierto: coincidencia de categoría y prioridad con la clasificación de referencia definida en `fixtures/support-cases.json`.
- Formato: categoría y prioridad válidas, respuesta no vacía y `requiresHumanReview` booleano.
- Revisión humana: se registra por separado si coincide con la referencia.
- Porcentaje: aciertos / total de casos × 100 por motor.
- Los 15 casos son una prueba funcional, no una medida estadística de precisión general.
