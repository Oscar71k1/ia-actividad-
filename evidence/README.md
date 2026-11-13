# Evidencias del avance

## Capturas de los resultados

Estas imágenes son capturas del navegador mostrando los resultados guardados de la ejecución real. Son vistas de evidencia, no capturas de una terminal ni de un motor generativo. Los archivos HTML incluidos permiten abrir las mismas vistas y los registros originales permiten verificar los datos.

### Ejemplos del motor tradicional

![Ocho ejemplos de clasificación](capturas/01-ejemplos.jpg)

### Pruebas automatizadas

![Diez pruebas aprobadas, cero fallos](capturas/02-pruebas.jpg)

### Petición y respuesta HTTP

![Petición y respuesta del motor tradicional mediante la API](capturas/03-api.jpg)

## Registros originales

Archivos obtenidos ejecutando el proyecto, sin respuestas generativas simuladas:

- [examples.txt](examples.txt): salida completa de los ocho ejemplos del motor tradicional.
- [tests.txt](tests.txt): salida del ejecutor de pruebas; 10 pruebas aprobadas y 0 fallos.
- [api.json](api.json): peticiones y respuestas HTTP reales para los diez casos de referencia, además del HTTP 501 que indica la integración generativa pendiente.

Cada registro de ejecución incluye fecha UTC y commit evaluado. La API se inició en un puerto temporal de localhost y se cerró después de recopilar las evidencias.

El motor tradicional coincidió en categoría y prioridad con los 10 casos de referencia (100% en este conjunto pequeño). Esto no demuestra precisión general ni constituye la comparación final con IA generativa. La integración real, sus evidencias y la conclusión comparativa quedan para el siguiente avance.

Para repetir los ejemplos y las pruebas desde la raíz del repositorio:

```sh
npm run examples
npm test
```

Para probar la API manualmente, ejecute `npm start` y utilice la petición de PowerShell del README principal.
