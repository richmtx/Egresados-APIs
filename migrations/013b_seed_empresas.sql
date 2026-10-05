-- =============================================================================
-- 013b_seed_empresas.sql
-- Siembra deliberada de variantes de nombre de empresa
--
-- Los datos semilla originales están limpios: la consulta de detección de
-- variantes regresó VACÍA. Sin variantes no hay forma de probar el detector
-- ni la pantalla de revisión. Mismo criterio que scripts/seed-duplicados.md.
--
-- Documentación legible: scripts/seed-empresas.md
-- La llave primaria de `egresados` es `id_egresado`.
--
-- Fecha: 2026-10-05
-- Autor: Ricardo Martínez (CIT - ITD)
-- =============================================================================

-- El COLLATE utf8mb4_0900_as_cs es obligatorio: la columna usa
-- utf8mb4_0900_ai_ci, que ignora mayúsculas y acentos. Sin él, después del
-- primer UPDATE la condición `empresa = 'Softtek'` también encontraría
-- 'SOFTTEK' y el segundo UPDATE pisaría al primero.

-- =============================================================================
-- GRUPO A: variantes que el detector SÍ debe encontrar
-- =============================================================================

-- 1. Oracle México -- mayúsculas
UPDATE egresados SET empresa = 'ORACLE MÉXICO'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Oracle México' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 2. Oracle México -- sin acento
UPDATE egresados SET empresa = 'Oracle Mexico'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Oracle México' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);

-- 3. Softtek -- mayúsculas
UPDATE egresados SET empresa = 'SOFTTEK'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Softtek' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 4. Softtek -- sufijo societario con puntos
UPDATE egresados SET empresa = 'Softtek S.A. de C.V.'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Softtek' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);

-- 5. Lear Corporation -- sufijo societario
UPDATE egresados SET empresa = 'Lear Corporation S.A. de C.V.'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Lear Corporation' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 6. Lear Corporation -- mayúsculas
UPDATE egresados SET empresa = 'LEAR CORPORATION'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Lear Corporation' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);

-- 7. Arca Continental -- doble espacio interno
UPDATE egresados SET empresa = 'Arca  Continental'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Arca Continental' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 8. Arca Continental -- minúsculas
UPDATE egresados SET empresa = 'arca continental'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Arca Continental' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);

-- 9. Grupo México -- sin acento
UPDATE egresados SET empresa = 'Grupo Mexico'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Grupo México' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 10. Grupo Bimbo -- coma + sufijo
UPDATE egresados SET empresa = 'Grupo Bimbo, S.A. de C.V.'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Grupo Bimbo' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 11. Nissan Mexicana -- sufijo sin puntos
UPDATE egresados SET empresa = 'Nissan Mexicana SA de CV'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Nissan Mexicana' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 12. FEMSA -- capitalización distinta
UPDATE egresados SET empresa = 'Femsa'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'FEMSA' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);

-- 13. John Deere -- espacios al inicio y final
UPDATE egresados SET empresa = '  John Deere  '
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'John Deere' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);

-- 14. Gobierno del Estado de Durango -- mayúsculas
UPDATE egresados SET empresa = 'GOBIERNO DEL ESTADO DE DURANGO'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Gobierno del Estado de Durango' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 15. HEB México -- sin acento + minúsculas
UPDATE egresados SET empresa = 'heb mexico'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'HEB México' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);


-- =============================================================================
-- GRUPO B: variantes que el detector NO puede encontrar solo
-- Comparten empresa en la realidad pero NO comparten nombre_clave.
-- Son la justificación de que la pantalla permita FUSIÓN MANUAL.
-- =============================================================================

-- 16. Sigla: CFE == Comisión Federal de Electricidad
UPDATE egresados SET empresa = 'CFE'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Comisión Federal de Electricidad' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 17. Prefijo: Grupo Lala == Lala
UPDATE egresados SET empresa = 'Grupo Lala'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Lala' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 18. Error de dedo: Softek (una sola t)
UPDATE egresados SET empresa = 'Softek'
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados WHERE empresa = 'Softtek' COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 1) t);


-- =============================================================================
-- GRUPO C: variante en primer_empleo_empresa
-- Prueba que el detector revisa las DOS columnas, no solo `empresa`.
-- =============================================================================

SET @pe_top := (
  SELECT primer_empleo_empresa FROM egresados
  WHERE primer_empleo_empresa IS NOT NULL AND TRIM(primer_empleo_empresa) <> ''
  GROUP BY primer_empleo_empresa
  ORDER BY COUNT(*) DESC, primer_empleo_empresa
  LIMIT 1
);

SELECT @pe_top AS empresa_elegida;  -- anota este valor, va al .md

-- 19. Mayúsculas
UPDATE egresados SET primer_empleo_empresa = UPPER(@pe_top)
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados
  WHERE primer_empleo_empresa = @pe_top COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 3) t);

-- 20. Sufijo societario
UPDATE egresados SET primer_empleo_empresa = CONCAT(@pe_top, ' S.A. de C.V.')
WHERE id_egresado IN (SELECT id_egresado FROM (
  SELECT id_egresado FROM egresados
  WHERE primer_empleo_empresa = @pe_top COLLATE utf8mb4_0900_as_cs
  ORDER BY id_egresado LIMIT 2) t);