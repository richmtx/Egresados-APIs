-- 005_fase3_datos_inclusion.sql
-- Fase 3: columnas y tablas de datos de inclusión.
--
-- REGLA: si el egresado no otorga consentimiento expreso, NO se
-- escribe ninguna fila en egresado_discapacidad ni egresado_identidad.
-- La ausencia de fila significa "no consintió o no se le preguntó".
-- Un grado 'no_declara' significa "se le preguntó y ejerció su
-- derecho a no responder". Son estados distintos.

USE egresados;

-- ---------------------------------------------------------------
-- 1. Columnas en egresados
-- ---------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN pais_nacimiento VARCHAR(80) NULL
    COMMENT 'País de nacimiento. NULL = no capturado.'
    AFTER ciudad_residencia,
  ADD COLUMN consintio_datos_sensibles TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Consentimiento expreso y separado para datos de inclusión.',
  ADD COLUMN fecha_consentimiento_sensibles DATETIME NULL
    COMMENT 'Momento en que se otorgó el consentimiento.';

ALTER TABLE egresados
  ADD INDEX idx_egresados_pais_nacimiento (pais_nacimiento);

-- ---------------------------------------------------------------
-- 2. Respuestas de discapacidad (6 filas por egresado que consintió)
-- ---------------------------------------------------------------
CREATE TABLE egresado_discapacidad (
  id_registro INT NOT NULL AUTO_INCREMENT,
  id_egresado INT NOT NULL,
  id_dominio  INT NOT NULL,
  id_grado    INT NOT NULL,
  PRIMARY KEY (id_registro),
  UNIQUE KEY uq_egresado_dominio (id_egresado, id_dominio),
  KEY idx_ed_grado (id_grado),
  CONSTRAINT fk_ed_egresado FOREIGN KEY (id_egresado)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_ed_dominio FOREIGN KEY (id_dominio)
    REFERENCES discapacidad_dominios (id_dominio) ON DELETE RESTRICT,
  CONSTRAINT fk_ed_grado FOREIGN KEY (id_grado)
    REFERENCES grados_dificultad (id_grado) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------
-- 3. Identidad cultural (una fila por egresado que consintió)
-- ---------------------------------------------------------------
CREATE TABLE egresado_identidad (
  id_registro          INT NOT NULL AUTO_INCREMENT,
  id_egresado          INT NOT NULL,
  id_indigena          INT NOT NULL COMMENT 'Se considera indígena',
  id_habla_lengua      INT NOT NULL COMMENT 'Habla alguna lengua indígena',
  lengua_indigena      VARCHAR(80) NULL COMMENT 'Texto libre, solo si habla_lengua = si',
  id_afromexicano      INT NOT NULL COMMENT 'Se considera afromexicano/a',
  PRIMARY KEY (id_registro),
  UNIQUE KEY uq_identidad_egresado (id_egresado),
  KEY idx_ei_indigena (id_indigena),
  KEY idx_ei_afromexicano (id_afromexicano),
  CONSTRAINT fk_ei_egresado FOREIGN KEY (id_egresado)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_ei_indigena FOREIGN KEY (id_indigena)
    REFERENCES respuestas_autoadscripcion (id_respuesta) ON DELETE RESTRICT,
  CONSTRAINT fk_ei_habla FOREIGN KEY (id_habla_lengua)
    REFERENCES respuestas_autoadscripcion (id_respuesta) ON DELETE RESTRICT,
  CONSTRAINT fk_ei_afro FOREIGN KEY (id_afromexicano)
    REFERENCES respuestas_autoadscripcion (id_respuesta) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;