# Comparación de motores

- Fecha UTC: 2026-11-13T00:22:51.951Z
- Commit: 38aa2385ebb9419093533917ad2182d04ed47258
- Node: v22.22.0
- Proveedor: Ollama (qwen2.5:3b) en http://127.0.0.1:11434
- Casos: 15

Un acierto exige coincidir en categoría y prioridad. Un error del proveedor cuenta como caso no acertado.

## Resultados por motor

| Motor | Aciertos | Porcentaje | Formato válido | Revisión humana correcta |
| --- | ---: | ---: | ---: | ---: |
| Tradicional | 15/15 | 100% | 15/15 (100%) | 15/15 (100%) |
| Generativo | 0/15 | 0% | 0/15 (0%) | 0/15 (0%) |

## Detalle por caso

| Caso | Tipo | Esperado | Tradicional | Generativo |
| --- | --- | --- | --- | --- |
| C01 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ❌ GENERATIVE_UNAVAILABLE |
| C02 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ❌ GENERATIVE_UNAVAILABLE |
| C03 | normal | BUG / MEDIUM | ✅ BUG / MEDIUM | ❌ GENERATIVE_UNAVAILABLE |
| C04 | normal | BUG / HIGH | ✅ BUG / HIGH | ❌ GENERATIVE_UNAVAILABLE |
| C05 | normal | FEATURE / LOW | ✅ FEATURE / LOW | ❌ GENERATIVE_UNAVAILABLE |
| C06 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ❌ GENERATIVE_UNAVAILABLE |
| C07 | ambiguous | BUG / MEDIUM | ✅ BUG / MEDIUM | ❌ GENERATIVE_UNAVAILABLE |
| C08 | ambiguous | FEATURE / LOW | ✅ FEATURE / LOW | ❌ GENERATIVE_UNAVAILABLE |
| C09 | adversarial | SECURITY / HIGH | ✅ SECURITY / HIGH | ❌ GENERATIVE_UNAVAILABLE |
| C10 | adversarial | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ❌ GENERATIVE_UNAVAILABLE |
| C11 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ❌ GENERATIVE_UNAVAILABLE |
| C12 | normal | SECURITY / HIGH | ✅ SECURITY / HIGH | ❌ GENERATIVE_UNAVAILABLE |
| C13 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ❌ GENERATIVE_UNAVAILABLE |
| C14 | ambiguous | BUG / MEDIUM | ✅ BUG / MEDIUM | ❌ GENERATIVE_UNAVAILABLE |
| C15 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ❌ GENERATIVE_UNAVAILABLE |

## Errores del proveedor

- C01 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C02 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C03 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C04 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C05 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C06 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C07 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C08 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C09 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C10 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C11 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C12 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C13 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C14 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
- C15 (generative): GENERATIVE_UNAVAILABLE — No se pudo conectar con el proveedor generativo local.
