-- ============================================================================
-- 014_fusiones_nombre_conservado.sql
--
-- Agrega a duplicados_fusiones el snapshot del nombre del egresado CONSERVADO.
--
-- POR QUÉ:
--   La bitácora de fusiones está hecha para sobrevivir al borrado de los
--   egresados, pero solo lo cumplía a medias:
--     - Del ELIMINADO guarda nombre_eliminado (texto) y su id va sin FK.
--     - Del CONSERVADO solo guardaba el id, con FK ON DELETE SET NULL.
--   Si después se borra al conservado (DELETE /egresados/:id), la fila queda
--   con id_egresado_conservado = NULL y ya no se sabe en quién se fusionó.
--
-- QUÉ HACE:
--   Agrega nombre_conservado, con el mismo tipo que nombre_eliminado
--   (VARCHAR(150) NOT NULL). La FK fk_fusion_conservado NO se toca: el id
--   sigue sirviendo mientras ese egresado exista; el nombre es el respaldo
--   para cuando ya no.
--
-- EL CÓDIGO YA LA NECESITA: POST /duplicados/fusionar la llena y
-- GET /duplicados/fusiones la lee. Sin esta migración aplicada, esas rutas
-- fallan con "Unknown column 'nombre_conservado'".
--
-- Fecha: 2026-10-06
-- ============================================================================

USE egresados;

-- Antes de aplicar: cuántas filas hay. Al escribir esta migración eran 0.
SELECT COUNT(*) AS fusiones_antes FROM duplicados_fusiones;

ALTER TABLE duplicados_fusiones
  ADD COLUMN nombre_conservado VARCHAR(150) NOT NULL
    COMMENT 'Nombre que TENIA el conservado al fusionar. Respaldo para cuando id_egresado_conservado quede en NULL'
    AFTER id_egresado_conservado;

-- Si para cuando se aplique ya hay fusiones, el ALTER las deja con '' y esto
-- las rellena con el nombre actual del conservado. Con 0 filas no hace nada.
-- Las que ya tengan id_egresado_conservado = NULL se quedan con '': ese
-- nombre ya no se puede recuperar.
UPDATE duplicados_fusiones f
JOIN egresados e ON e.id_egresado = f.id_egresado_conservado
SET f.nombre_conservado = e.nombre_completo
WHERE f.nombre_conservado = '';


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- DEBE devolver 1 fila: varchar(150), NO nulo, igual que nombre_eliminado
SHOW COLUMNS FROM duplicados_fusiones LIKE 'nombre_conservado';
SHOW COLUMNS FROM duplicados_fusiones LIKE 'nombre_eliminado';

-- La FK del conservado sigue ahí, con SET NULL
SELECT CONSTRAINT_NAME, DELETE_RULE
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'egresados'
  AND TABLE_NAME = 'duplicados_fusiones';

-- DEBE devolver 0: ninguna fusión con conservado vivo y nombre vacío
SELECT COUNT(*) AS sin_nombre
FROM duplicados_fusiones
WHERE id_egresado_conservado IS NOT NULL AND nombre_conservado = '';


-- ============================================================================
-- ROLLBACK (no correr salvo que haya que deshacer la migración)
-- Ojo: el código de duplicados ya usa la columna; al quitarla hay que
-- revertir también el cambio en src/duplicados/duplicados.service.ts.
-- ============================================================================
-- ALTER TABLE duplicados_fusiones
--   DROP COLUMN nombre_conservado;
-- ============================================================================
