# Parejas de duplicados sembrados

Generadas por `scripts/seed-egresados.ts` (semilla determinista = 2026) para probar la detección de duplicados (Fase 6).

| # | Tipo | id | nombre_completo | correo | numero_control | registro_completo |
|---|------|----|--------------------|--------|-----------------|--------------------|
| 1 | Mismo número de control, mismo nombre, correos distintos | 1 | Eduardo Cervantes Soto | eduardosoto920@gmail.com | 09042934 | 1 |
|   |      | 2 | Eduardo Cervantes Soto | eduardo.soto171@yahoo.com | 09042934 | 1 |
| 2 | numero_control con prefijo de cambio de carrera ("c") vs sin prefijo | 3 | Carolina Mendoza López | carolina.lopez104@gmail.com | c21040123 | 1 |
|   |      | 4 | Carolina Mendoza López | carolina.lopez@hotmail.com | 21040123 | 1 |
| 3 | Mismo nombre y carrera: con acentos vs sin acentos | 5 | José Hernández Bátiz | jose.batiz@hotmail.com | 17041316 | 1 |
|   |      | 6 | Jose Hernandez Batiz | jose.batiz@outlook.com | 17046506 | 1 |
| 4 | Mismo nombre con el orden de apellidos/nombres invertido | 7 | Pérez López Ana María | perezmaria627@outlook.com | 16045163 | 1 |
|   |      | 8 | Ana María Pérez López | analopez84@hotmail.com | 16043783 | 1 |
| 5 | Mismo teléfono, nombre con una letra distinta ("Adrian"/"Adrián") | 9 | Adrian Fernando Nevárez Soto | adrian.soto78@hotmail.com | 09046398 | 1 |
|   |      | 10 | Adrián Fernando Nevárez Soto | adriansoto75@hotmail.com | 09049947 | 1 |
| 6 | Mismo nombre y carrera, años de egreso con 1 año de diferencia | 11 | Jesús Alberto Mendoza Castro | jesus.castro366@gmail.com | c11043542 | 1 |
|   |      | 12 | Jesús Alberto Mendoza Castro | jesus.castro@yahoo.com | 10041390 | 1 |
| 7 | Uno completó etapa 2, el otro se quedó en etapa 1 (mismo nombre y carrera) | 13 | Gustavo Hernández Morales | gmorales537@hotmail.com | 22049153 | 1 |
|   |      | 14 | Gustavo Hernández Morales | gustavo.morales389@hotmail.com | (vacío) | 0 |
| 8 | Mismo nombre, carrera y datos distintos — NO es duplicado (falso positivo de control) | 15 | Luis Fernando Ramírez Soto | luis.soto@outlook.com | 14045742 | 1 |
|   |      | 16 | Luis Fernando Ramírez Soto | lsoto911@yahoo.com | 12042982 | 1 |
