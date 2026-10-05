# Variantes de nombre de empresa sembradas

Generadas por `scripts/seed-egresados.ts` (semilla determinista = 2026) para probar la normalización de empresas (`/admin/empresas`).

Las variantes quedan **sin fusionar**: el seed deja vacías `empresas` y `empresas_candidatos`. Hay que correr `POST /admin/empresas/detectar` y revisarlas en la pantalla de administración.

Las variantes van entre comillas para que se vean los espacios: `"  John Deere  "` lleva dos al inicio y dos al final, y `"Arca  Continental"` un doble espacio interno. Son intencionales.

| Variante | Canónico | Egresados en `empresa` | Egresados en `primer_empleo_empresa` | ¿La agrupa el detector? |
|----------|----------|------------------------|--------------------------------------|--------------------------|
| `"ORACLE MÉXICO"` | Oracle México | 3 | 7 | Sí |
| `"Oracle Mexico"` | Oracle México | 2 | 2 | Sí |
| `"SOFTTEK"` | Softtek | 0 | 1 | Sí |
| `"Softtek S.A. de C.V."` | Softtek | 2 | 3 | Sí |
| `"Softek"` | Softtek | 0 | 1 | **No** |
| `"Lear Corporation S.A. de C.V."` | Lear Corporation | 1 | 3 | Sí |
| `"LEAR CORPORATION"` | Lear Corporation | 3 | 5 | Sí |
| `"Arca  Continental"` | Arca Continental | 2 | 3 | Sí |
| `"arca continental"` | Arca Continental | 5 | 1 | Sí |
| `"Grupo Mexico"` | Grupo México | 9 | 8 | Sí |
| `"Grupo Bimbo, S.A. de C.V."` | Grupo Bimbo | 5 | 3 | Sí |
| `"Nissan Mexicana SA de CV"` | Nissan Mexicana | 2 | 7 | Sí |
| `"Femsa"` | FEMSA | 3 | 3 | Sí |
| `"  John Deere  "` | John Deere | 7 | 3 | Sí |
| `"GOBIERNO DEL ESTADO DE DURANGO"` | Gobierno del Estado de Durango | 3 | 3 | Sí |
| `"heb mexico"` | HEB México | 6 | 8 | Sí |
| `"CFE"` | Comisión Federal de Electricidad | 3 | 3 | **No** |
| `"COMISIÓN FEDERAL DE ELECTRICIDAD"` | Comisión Federal de Electricidad | 1 | 1 | Sí |
| `"Comisión Federal de Electricidad S.A. de C.V."` | Comisión Federal de Electricidad | 3 | 2 | Sí |
| `"Grupo Lala"` | Lala | 2 | 7 | **No** |

## Por qué CFE, Softek y Grupo Lala no son detectables

El detector agrupa los textos por una clave normalizada: minúsculas, sin puntos ni comas, sin sufijo societario, espacios colapsados, y comparada sin distinguir acentos. Eso junta `SOFTTEK`, `Softtek S.A. de C.V.` y `Softtek`, pero no puede saber que dos textos distintos nombran a la misma empresa:

- `CFE` es la sigla de Comisión Federal de Electricidad: no comparten ni una palabra.
- `Softek` es un error de dedo de Softtek: le falta una letra, así que la clave es otra.
- `Grupo Lala` lleva un prefijo que `Lala` no tiene.

Existen a propósito: son los casos que justifican la fusión manual (`POST /admin/empresas/fusionar` acepta variantes que no comparten clave). No hay que corregirlos en el seed.
