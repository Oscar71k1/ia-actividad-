# Comparación de motores

- Fecha UTC: 2026-11-13T05:03:49.016Z
- Commit: dc9c60e72080ea58d882a090460190aa66985d98
- Node: v22.22.0
- Proveedor: Groq (openai/gpt-oss-120b) en https://api.groq.com/openai/v1
- Casos: 15

Un acierto exige coincidir en categoría y prioridad. Un error del proveedor cuenta como caso no acertado.

## Resultados por motor

| Motor | Aciertos | Porcentaje | Formato válido | Revisión humana correcta |
| --- | ---: | ---: | ---: | ---: |
| Tradicional | 15/15 | 100% | 15/15 (100%) | 15/15 (100%) |
| Generativo | 14/15 | 93.3% | 15/15 (100%) | 15/15 (100%) |

## Detalle por caso

| Caso | Tipo | Esperado | Tradicional | Generativo |
| --- | --- | --- | --- | --- |
| C01 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ✅ ACCESS / MEDIUM |
| C02 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ✅ ACCESS / MEDIUM |
| C03 | normal | BUG / MEDIUM | ✅ BUG / MEDIUM | ✅ BUG / MEDIUM |
| C04 | normal | BUG / HIGH | ✅ BUG / HIGH | ✅ BUG / HIGH |
| C05 | normal | FEATURE / LOW | ✅ FEATURE / LOW | ✅ FEATURE / LOW |
| C06 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ✅ SECURITY / CRITICAL |
| C07 | ambiguous | BUG / MEDIUM | ✅ BUG / MEDIUM | ✅ BUG / MEDIUM |
| C08 | ambiguous | FEATURE / LOW | ✅ FEATURE / LOW | ✅ FEATURE / LOW |
| C09 | adversarial | SECURITY / HIGH | ✅ SECURITY / HIGH | ✅ SECURITY / HIGH |
| C10 | adversarial | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ✅ SECURITY / CRITICAL |
| C11 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ✅ SECURITY / CRITICAL |
| C12 | normal | SECURITY / HIGH | ✅ SECURITY / HIGH | ❌ SECURITY / CRITICAL |
| C13 | normal | ACCESS / MEDIUM | ✅ ACCESS / MEDIUM | ✅ ACCESS / MEDIUM |
| C14 | ambiguous | BUG / MEDIUM | ✅ BUG / MEDIUM | ✅ BUG / MEDIUM |
| C15 | normal | SECURITY / CRITICAL | ✅ SECURITY / CRITICAL | ✅ SECURITY / CRITICAL |

## Errores del proveedor

No se registraron errores del proveedor generativo.
