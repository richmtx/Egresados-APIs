-- =============================================================================
-- 013_empresas.sql
-- Normalización de nombres de empresas
--
-- Crea el catálogo canónico de empresas y la tabla de candidatos a fusión.
-- NO modifica ni borra el texto que escribió el egresado: las columnas
-- `empresa` y `primer_empleo_empresa` quedan intactas y se agregan dos FK
-- nullable al lado. Un egresado con empresa_id = NULL simplemente no ha
-- sido revisado todavía.
--
-- Convención de nombres: PK `id_<tabla>`, FK `<tabla>_id`, igual que el
-- resto del esquema (id_egresado / carrera_id, genero_id).
--
-- Fecha: 2026-10-05
-- Autor: Ricardo Martínez (CIT - ITD)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Catálogo canónico de empresas
-- -----------------------------------------------------------------------------
CREATE TABLE empresas (
  id_empresa INT AUTO_INCREMENT PRIMARY KEY,

  nombre VARCHAR(255) NOT NULL
    COMMENT 'Nombre canónico, tal como debe aparecer en reportes',

  -- Clave de agrupación: minúsculas, sin puntos ni comas, sin sufijos
  -- societarios, espacios colapsados. Todas las funciones usadas son
  -- deterministas, requisito de MySQL para columnas generadas.
  nombre_clave VARCHAR(255) GENERATED ALWAYS AS (
    TRIM(
      TRIM(TRAILING ' sa' FROM
        TRIM(TRAILING ' sa de cv' FROM
          TRIM(TRAILING ' sapi de cv' FROM
            TRIM(TRAILING ' s de rl de cv' FROM
              TRIM(TRAILING ' sc' FROM
                REPLACE(REPLACE(REPLACE(
                  LOWER(TRIM(nombre))
                , '.', ''), ',', ''), '  ', ' ')
    ))))))
  ) STORED
    COMMENT 'Clave normalizada para detectar variantes. Columna GENERADA: no acepta INSERT ni UPDATE (error 3105)',

  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_empresas_clave (nombre_clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Catálogo canónico de empresas (013)';

-- -----------------------------------------------------------------------------
-- 2. Candidatos a fusión (una fila por variante encontrada en los datos)
-- -----------------------------------------------------------------------------
CREATE TABLE empresas_candidatos (
  id_empresa_candidato INT AUTO_INCREMENT PRIMARY KEY,

  nombre_clave VARCHAR(255) NOT NULL
    COMMENT 'Clave que agrupa esta variante con las demás del mismo grupo',

  -- COLLATE case-sensitive a propósito: con utf8mb4_0900_ai_ci, 'Softtek' y
  -- 'SOFTTEK' se consideran iguales y el UNIQUE rechazaría justo el caso que
  -- queremos detectar.
  nombre_variante VARCHAR(255) COLLATE utf8mb4_0900_as_cs NOT NULL
    COMMENT 'Texto crudo tal como está escrito en egresados',

  nombre_sugerido VARCHAR(255) NOT NULL
    COMMENT 'Nombre canónico propuesto por el detector',

  ocurrencias_empresa INT NOT NULL DEFAULT 0,
  ocurrencias_primer_empleo INT NOT NULL DEFAULT 0,

  estado ENUM('pendiente','fusionado','descartado') NOT NULL DEFAULT 'pendiente',

  empresa_id INT NULL
    COMMENT 'Se llena al fusionar; apunta al registro canónico elegido',

  detectado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revisado_por VARCHAR(100) NULL,
  revisado_en DATETIME NULL,

  UNIQUE KEY uq_cand_variante (nombre_variante),
  KEY idx_cand_clave (nombre_clave),
  KEY idx_cand_estado (estado),

  CONSTRAINT fk_cand_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id_empresa) ON DELETE SET NULL,

  -- Un candidato pendiente no puede traer datos de revisión, y uno revisado
  -- no puede venir sin ellos. Mismo criterio que duplicados_candidatos.
  CONSTRAINT chk_cand_revision CHECK (
    (estado = 'pendiente'  AND revisado_por IS NULL     AND revisado_en IS NULL)
    OR
    (estado <> 'pendiente' AND revisado_por IS NOT NULL AND revisado_en IS NOT NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Variantes de nombre de empresa detectadas, pendientes de revisión (013)';

-- -----------------------------------------------------------------------------
-- 3. FK nullable en egresados (no destructivo)
-- -----------------------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN empresa_id INT NULL AFTER empresa,
  ADD COLUMN primer_empleo_empresa_id INT NULL AFTER primer_empleo_empresa;

ALTER TABLE egresados
  ADD CONSTRAINT fk_egresados_empresa
    FOREIGN KEY (empresa_id) REFERENCES empresas(id_empresa) ON DELETE SET NULL,
  ADD CONSTRAINT fk_egresados_primer_empleo_empresa
    FOREIGN KEY (primer_empleo_empresa_id) REFERENCES empresas(id_empresa) ON DELETE SET NULL;

ALTER TABLE egresados
  ADD KEY idx_egresados_empresa_id (empresa_id),
  ADD KEY idx_egresados_primer_empleo_empresa_id (primer_empleo_empresa_id);


-- =============================================================================
-- ROLLBACK (no correr salvo que haya que deshacer la migración)
-- =============================================================================
-- ALTER TABLE egresados
--   DROP FOREIGN KEY fk_egresados_empresa,
--   DROP FOREIGN KEY fk_egresados_primer_empleo_empresa;
--
-- ALTER TABLE egresados
--   DROP COLUMN empresa_id,
--   DROP COLUMN primer_empleo_empresa_id;
--
-- DROP TABLE empresas_candidatos;
-- DROP TABLE empresas;
-- =============================================================================