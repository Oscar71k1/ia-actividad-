# Comparación de motores

- Fecha UTC: 2026-11-17T21:28:29.023Z
- Commit: 32cca7e61c918504971253458b126be0cb59282d
- Node: v22.22.0
- Proveedor: Groq (openai/gpt-oss-120b) en https://api.groq.com/openai/v1
- Casos: 10

Un acierto exige coincidir en categoría y prioridad. Un error del proveedor cuenta como caso no acertado.

## Resultados por motor

| Motor | Aciertos | Porcentaje | Formato válido | Revisión humana correcta |
| --- | ---: | ---: | ---: | ---: |
| Tradicional | 10/10 | 100% | 10/10 (100%) | 10/10 (100%) |
| Generativo | 9/10 | 90% | 10/10 (100%) | 9/10 (90%) |

## Detalle por caso

| Caso | Tipo | Esperado | Tradicional | Generativo |
| --- | --- | --- | --- | --- |
| C01 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ✅ ACCESS / MEDIUM |
| C02 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ✅ ACCESS / MEDIUM |
| C03 | normal | BUG / MEDIUM | ✅ BUG / MEDIUM | ✅ BUG / MEDIUM |
| C04 | normal | BUG / HIGH | ✅ BUG / HIGH | ❌ BUG / MEDIUM |
| C05 | normal | FEATURE / LOW | ✅ FEATURE / LOW | ✅ FEATURE / LOW |
| C06 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ✅ SECURITY / CRITICAL |
| C07 | ambiguous | BUG / MEDIUM | ✅ BUG / MEDIUM | ✅ BUG / MEDIUM |
| C08 | ambiguous | FEATURE / LOW | ✅ FEATURE / LOW | ✅ FEATURE / LOW |
| C09 | adversarial | SECURITY / HIGH | ✅ SECURITY / HIGH | ✅ SECURITY / HIGH |
| C10 | adversarial | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ✅ SECURITY / CRITICAL |

## Errores del proveedor

No se registraron errores del proveedor generativo.
