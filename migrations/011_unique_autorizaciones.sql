-- ============================================================================
-- 011_unique_autorizaciones.sql
--
-- La tabla autorizaciones se une 1:1 con egresados en unos siete listados y
-- exportaciones (egresados.service.ts, export.service.ts). Una segunda fila
-- para el mismo egresado lo duplicaría en TODOS esos resultados sin que nadie
-- se diera cuenta.
--
-- Hoy la tabla está limpia (verificado: 0 egresados con más de una fila),
-- así que este índice solo impide que el problema aparezca en el futuro.
--
-- Nota: id_egresado permite NULL. Un índice UNIQUE en MySQL tolera varios
-- NULL, así que esas filas no se ven afectadas.
-- ============================================================================

USE egresados;

-- 1. Volver a confirmar que está limpia. DEBE devolver 0 filas.
--    Si devuelve algo, NO corras el ALTER: primero hay que decidir qué fila
--    se queda en cada caso.
SELECT id_egresado, COUNT(*) AS filas
FROM autorizaciones
WHERE id_egresado IS NOT NULL
GROUP BY id_egresado
HAVING COUNT(*) > 1;

-- 2. El índice
ALTER TABLE autorizaciones
  ADD UNIQUE KEY uq_autorizaciones_egresado (id_egresado);

-- 3. Verificación
SHOW INDEX FROM autorizaciones WHERE Key_name = 'uq_autorizaciones_egresado';