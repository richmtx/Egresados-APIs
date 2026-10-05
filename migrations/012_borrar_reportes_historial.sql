-- ============================================================================
-- 012_borrar_reportes_historial.sql
--
-- Elimina la tabla reportes_historial, huérfana desde la Fase 0.
--
-- POR QUÉ SE BORRA:
--   - Ningún código la toca. Verificado con búsqueda de texto en el src/ de
--     los tres proyectos (egresados-apis, egresados-back, egresados-front):
--     cero coincidencias.
--   - Ninguna llave foránea la referencia, y ella no referencia a nadie.
--   - Su función ya la cubre historial_actividad: cada exportación a PDF o
--     Excel se registra ahí con registrarAccion.
--   - Sus 4 filas son del 21 de mayo de 2026, todas del mismo día en 25
--     minutos. Son pruebas de una funcionalidad que nunca se terminó.
--
-- La estructura y los datos quedan respaldados en el bloque de ROLLBACK de
-- abajo, así que este archivo es a la vez la migración y el respaldo.
-- ============================================================================

USE egresados;

-- Último seguro: si alguien agregó una FK apuntando aquí desde que
-- revisamos, esta consulta lo delata. DEBE devolver 0 filas.
SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_SCHEMA = 'egresados'
  AND REFERENCED_TABLE_NAME   = 'reportes_historial';

-- El borrado
DROP TABLE IF EXISTS reportes_historial;


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- DEBE devolver 0 filas: la tabla ya no existe
SHOW TABLES LIKE 'reportes_historial';

-- Las demás tablas siguen en su lugar
SELECT COUNT(*) AS total_tablas
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'egresados';

-- Y los datos del sistema no se movieron
SELECT (SELECT COUNT(*) FROM egresados)             AS egresados,
       (SELECT COUNT(*) FROM duplicados_candidatos) AS candidatos,
       (SELECT COUNT(*) FROM historial_actividad)   AS historial;


-- ============================================================================
-- ROLLBACK — respaldo completo de la tabla al 5 de octubre de 2026
-- Para recrearla tal como estaba, descomenta y ejecuta todo este bloque.
-- ============================================================================
--
-- CREATE TABLE `reportes_historial` (
--   `id_reporte`       int NOT NULL AUTO_INCREMENT,
--   `tipo_reporte`     varchar(50)  NOT NULL,
--   `organismo`        varchar(20)  NOT NULL,
--   `carrera`          varchar(100) DEFAULT NULL,
--   `anio`             int          DEFAULT NULL,
--   `formato`          varchar(10)  NOT NULL DEFAULT 'PDF',
--   `generado_por`     varchar(100) NOT NULL DEFAULT 'Sistema',
--   `fecha_generacion` datetime     NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (`id_reporte`)
-- ) ENGINE=InnoDB AUTO_INCREMENT=12
--   DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--
-- INSERT INTO `reportes_historial`
--   (`id_reporte`, `tipo_reporte`, `organismo`, `carrera`, `anio`,
--    `formato`, `generado_por`, `fecha_generacion`) VALUES
--   (7,  'Reporte Anual de Seguimiento de Egresados', 'TecNM', NULL, NULL, 'PDF', 'Administrador', '2026-05-21 20:57:25'),
--   (8,  'Reporte Anual de Seguimiento de Egresados', 'TecNM', NULL, 2026, 'PDF', 'Administrador', '2026-05-21 20:57:55'),
--   (9,  'Reporte Anual de Seguimiento de Egresados', 'TecNM', NULL, 2026, 'PDF', 'Administrador', '2026-05-21 20:57:57'),
--   (11, 'Reporte Anual de Seguimiento de Egresados', 'TecNM', NULL, NULL, 'PDF', 'Administrador', '2026-05-21 21:22:16');
--
-- ============================================================================