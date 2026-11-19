# Motor ML: adaptación del script de Python a Node.js

El código de partida entrena un clasificador de tickets con **pandas + scikit-learn**: lee `tickets.csv`, separa 80/20 de forma estratificada, vectoriza el texto con TF‑IDF (unigramas y bigramas), entrena una regresión logística, imprime `classification_report` y clasifica un mensaje nuevo.

Este proyecto es Node.js 22, no usa Python ni paquetes npm. La adaptación mantiene **la misma secuencia de pasos**, implementada en `src/ml.mjs` con `node:` builtins.

## Correspondencia con el código original

| Python | JavaScript | Archivo |
| --- | --- | --- |
| `pd.read_csv("tickets.csv")` | `loadTickets()` + `parseCsv()` | `src/ml.mjs`, `fixtures/tickets.csv` |
| `train_test_split(..., test_size=0.2, stratify=data["category"], random_state=42)` | `trainTestSplit()` con PRNG `mulberry32(42)` | `src/ml.mjs` |
| `TfidfVectorizer(ngram_range=(1, 2))` | `TfidfVectorizer` (IDF `ln((1+N)/(1+df))+1`, norma L2) | `src/ml.mjs` |
| `LogisticRegression(max_iter=1000)` | `LogisticRegression` (softmax, gradiente por lotes, 800 épocas, L2) | `src/ml.mjs` |
| `model.fit(X_train, y_train)` | `trainModel(train)` | `src/ml.mjs` |
| `classification_report(y_test, predictions)` | `evaluateModel()` + `formatClassificationReport()` | `src/ml.mjs` |
| `model.predict([...])` | `analyzeMl()` | `src/ml.mjs` |

El CSV reemplaza a `tickets.csv`: tiene 80 filas con `message,category` (20 por categoría) e incluye variantes normales, ambiguas y adversariales. Se puede sustituir por otro archivo con las mismas columnas; `loadTickets(url)` acepta la ruta.

### ¿Por qué no Danfo.js?

Danfo.js (`danfojs-node`) es una librería "inspirada en Pandas" que sí permite leer CSV y usar DataFrames en JavaScript, pero **no incluye TF‑IDF ni regresión logística**: solo cubre la parte de `pd.read_csv`. Además añadiría una dependencia npm y cambiaría la restricción del proyecto de "sin paquetes npm". Por eso se implementó el lector CSV con `node:fs` (`parseCsv`) y el modelo en `src/ml.mjs`. Si más adelante se autorizan dependencias, `loadTickets()` podría cambiar internamente por `dfd.readCSV()` sin afectar al resto del motor.

## Diferencias respecto al contrato del proyecto

El modelo de Python solo devuelve una categoría. La API de este proyecto exige `category`, `priority`, `response`, `requiresHumanReview` y `mode`, por lo que `analyzeMl()` añade:

- `priority` y `response` calculados con las mismas reglas del motor tradicional (`src/traditional.mjs`).
- `requiresHumanReview: true` para `SECURITY` y para predicciones con confianza inferior a 0.6.
- `mode: 'ml'` fijado por el servidor.

La validación de entrada y el límite de 5000 caracteres son los mismos que en los otros motores.

## Ejecución

```sh
npm run examples:ml          # informe de entrenamiento/evaluación + predicción de ejemplo
npm test                     # incluye pruebas del motor ML
npm start                    # API local
```

Ejemplo de petición:

```powershell
$body = @{ message = 'Alguien entró a mi cuenta sin autorización'; mode = 'ml' } | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:3000/api/analyze -Method Post -ContentType 'application/json' -Body $body
```

## Resultado de la ejecución de referencia

Con 64 tickets de entrenamiento y 16 de prueba (semilla 42):

| Categoría | Precisión | Recall | F1 | Soporte |
| --- | ---: | ---: | ---: | ---: |
| ACCESS | 0.50 | 0.75 | 0.60 | 4 |
| BUG | 0.75 | 0.75 | 0.75 | 4 |
| FEATURE | 0.67 | 0.50 | 0.57 | 4 |
| SECURITY | 0.67 | 0.50 | 0.57 | 4 |

Exactitud: 0.63. El mensaje de ejemplo se clasifica como `SECURITY / HIGH` con revisión humana.

## Limitaciones

- Es una reimplementación didáctica, no una réplica numérica de scikit-learn: los valores de regularización y optimización son propios.
- El conjunto de 80 ejemplos es pequeño; el informe es una prueba funcional, no una medición de precisión general.
- El vocabulario se construye solo con el entrenamiento; los términos nuevos se ignoran.
- No se exponen probabilidades en la respuesta porque el contrato de la API no las incluye.
