# Parejas de duplicados sembrados

Generadas por `scripts/seed-egresados.ts` (semilla determinista = 2026) para probar la detección de duplicados (Fase 6).

| # | Tipo | id | nombre_completo | correo | numero_control | registro_completo |
|---|------|----|--------------------|--------|-----------------|--------------------|
| 1 | Mismo número de control, mismo nombre, correos distintos | 1 | Eduardo Cervantes Soto | eduardosoto920@gmail.com | 09042934 | 1 |
|   |      | 2 | Eduardo Cervantes Soto | eduardosoto589@gmail.com | 09042934 | 1 |
| 2 | numero_control con prefijo de cambio de carrera ("c") vs sin prefijo | 3 | Daniela Quintero Mendoza | daniela.mendoza56@gmail.com | c21040123 | 1 |
|   |      | 4 | Daniela Quintero Mendoza | daniela.mendoza@hotmail.com | 21040123 | 1 |
| 3 | Mismo nombre y carrera: con acentos vs sin acentos | 5 | José Hernández Bátiz | jose.batiz@outlook.com | 17046315 | 1 |
|   |      | 6 | Jose Hernandez Batiz | josebatiz66@hotmail.com | 17047314 | 1 |
| 4 | Mismo nombre con el orden de apellidos/nombres invertido | 7 | Pérez López Ana María | perez.maria578@gmail.com | 16040935 | 1 |
|   |      | 8 | Ana María Pérez López | analopez521@outlook.com | 16043286 | 1 |
| 5 | Mismo teléfono, nombre con una letra distinta ("Adrian"/"Adrián") | 9 | Adrian Fernando Nevárez Soto | adrian.soto947@gmail.com | 09047455 | 1 |
|   |      | 10 | Adrián Fernando Nevárez Soto | asoto944@gmail.com | 09045002 | 1 |
| 6 | Mismo nombre y carrera, años de egreso con 1 año de diferencia | 11 | Ernesto Reyes Torres | etorres76@gmail.com | 22044748 | 1 |
|   |      | 12 | Ernesto Reyes Torres | ernestotorres512@yahoo.com | c14043652 | 1 |
| 7 | Uno completó etapa 2, el otro se quedó en etapa 1 (mismo nombre y carrera) | 13 | Diana Domínguez Ramos | dramos221@gmail.com | 11045370 | 1 |
|   |      | 14 | Diana Domínguez Ramos | diana.ramos228@hotmail.com | (vacío) | 0 |
| 8 | Mismo nombre, carrera y datos distintos — NO es duplicado (falso positivo de control) | 15 | Luis Fernando Ramírez Soto | luissoto610@gmail.com | 14047553 | 1 |
|   |      | 16 | Luis Fernando Ramírez Soto | lsoto328@outlook.com | 16041052 | 1 |
