# Variantes de nombre de empresa sembradas

Generadas por `scripts/seed-egresados.ts` (semilla determinista = 2026) para probar la normalización de empresas (`/admin/empresas`).

Las variantes quedan **sin fusionar**: el seed deja vacías `empresas` y `empresas_candidatos`. Hay que correr `POST /admin/empresas/detectar` y revisarlas en la pantalla de administración.

Las variantes van entre comillas para que se vean los espacios: `"  John Deere  "` lleva dos al inicio y dos al final, y `"Arca  Continental"` un doble espacio interno. Son intencionales.

| Variante | Canónico | Egresados en `empresa` | Egresados en `primer_empleo_empresa` | ¿La agrupa el detector? |
|----------|----------|------------------------|--------------------------------------|--------------------------|
| `"ORACLE MÉXICO"` | Oracle México | 1 | 2 | Sí |
| `"Oracle Mexico"` | Oracle México | 2 | 4 | Sí |
| `"SOFTTEK"` | Softtek | 0 | 2 | Sí |
| `"Softtek S.A. de C.V."` | Softtek | 2 | 5 | Sí |
| `"Softek"` | Softtek | 2 | 3 | **No** |
| `"Lear Corporation S.A. de C.V."` | Lear Corporation | 5 | 5 | Sí |
| `"LEAR CORPORATION"` | Lear Corporation | 1 | 1 | Sí |
| `"Arca  Continental"` | Arca Continental | 1 | 3 | Sí |
| `"arca continental"` | Arca Continental | 2 | 2 | Sí |
| `"Grupo Mexico"` | Grupo México | 4 | 8 | Sí |
| `"Grupo Bimbo, S.A. de C.V."` | Grupo Bimbo | 4 | 9 | Sí |
| `"Nissan Mexicana SA de CV"` | Nissan Mexicana | 1 | 11 | Sí |
| `"Femsa"` | FEMSA | 8 | 7 | Sí |
| `"  John Deere  "` | John Deere | 3 | 6 | Sí |
| `"GOBIERNO DEL ESTADO DE DURANGO"` | Gobierno del Estado de Durango | 2 | 5 | Sí |
| `"heb mexico"` | HEB México | 4 | 9 | Sí |
| `"CFE"` | Comisión Federal de Electricidad | 1 | 3 | **No** |
| `"COMISIÓN FEDERAL DE ELECTRICIDAD"` | Comisión Federal de Electricidad | 0 | 2 | Sí |
| `"Comisión Federal de Electricidad S.A. de C.V."` | Comisión Federal de Electricidad | 1 | 2 | Sí |
| `"Grupo Lala"` | Lala | 3 | 10 | **No** |

## Por qué CFE, Softek y Grupo Lala no son detectables

El detector agrupa los textos por una clave normalizada: minúsculas, sin puntos ni comas, sin sufijo societario, espacios colapsados, y comparada sin distinguir acentos. Eso junta `SOFTTEK`, `Softtek S.A. de C.V.` y `Softtek`, pero no puede saber que dos textos distintos nombran a la misma empresa:

- `CFE` es la sigla de Comisión Federal de Electricidad: no comparten ni una palabra.
- `Softek` es un error de dedo de Softtek: le falta una letra, así que la clave es otra.
- `Grupo Lala` lleva un prefijo que `Lala` no tiene.

Existen a propósito: son los casos que justifican la fusión manual (`POST /admin/empresas/fusionar` acepta variantes que no comparten clave). No hay que corregirlos en el seed.
