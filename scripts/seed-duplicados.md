# Parejas de duplicados sembrados

Generadas por `scripts/seed-egresados.ts` (semilla determinista = 2026) para probar la detección de duplicados (Fase 6).

| # | Tipo | id | nombre_completo | correo | numero_control | registro_completo |
|---|------|----|--------------------|--------|-----------------|--------------------|
| 1 | Mismo número de control, mismo nombre, correos distintos | 1 | Eduardo Cervantes Soto | eduardosoto920@gmail.com | 09042934 | 1 |
|   |      | 2 | Eduardo Cervantes Soto | eduardosoto589@gmail.com | 09042934 | 1 |
| 2 | numero_control con prefijo de cambio de carrera ("c") vs sin prefijo | 3 | Daniela Quintero Mendoza | daniela.mendoza56@gmail.com | c21040123 | 1 |
|   |      | 4 | Daniela Quintero Mendoza | danielamendoza962@hotmail.com | 21040123 | 1 |
| 3 | Mismo nombre y carrera: con acentos vs sin acentos | 5 | José Hernández Bátiz | jbatiz712@hotmail.com | 17046704 | 1 |
|   |      | 6 | Jose Hernandez Batiz | jbatiz111@gmail.com | c17040878 | 1 |
| 4 | Mismo nombre con el orden de apellidos/nombres invertido | 7 | Pérez López Ana María | perez.maria882@gmail.com | 11047553 | 1 |
|   |      | 8 | Ana María Pérez López | alopez88@hotmail.com | 11048927 | 1 |
| 5 | Mismo teléfono, nombre con una letra distinta ("Adrian"/"Adrián") | 9 | Adrian Fernando Nevárez Soto | adriansoto425@gmail.com | 14041161 | 1 |
|   |      | 10 | Adrián Fernando Nevárez Soto | adriansoto66@gmail.com | 14041685 | 1 |
| 6 | Mismo nombre y carrera, años de egreso con 1 año de diferencia | 11 | Jimena Ruiz Domínguez | jdominguez188@yahoo.com | 01040735 | 1 |
|   |      | 12 | Jimena Ruiz Domínguez | jimena.dominguez439@gmail.com | 06049320 | 1 |
| 7 | Uno completó etapa 2, el otro se quedó en etapa 1 (mismo nombre y carrera) | 13 | Joel Urbina Morales | joelmorales526@gmail.com | 10045292 | 1 |
|   |      | 14 | Joel Urbina Morales | jmorales746@hotmail.com | (vacío) | 0 |
| 8 | Mismo nombre, carrera y datos distintos — NO es duplicado (falso positivo de control) | 15 | Luis Fernando Ramírez Soto | luis.soto511@hotmail.com | 08049738 | 1 |
|   |      | 16 | Luis Fernando Ramírez Soto | luis.soto@gmail.com | 22045217 | 1 |
