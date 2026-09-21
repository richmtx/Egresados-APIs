-- 006_fase4_trayectoria.sql
-- Fase 4: trayectoria profesional, estudios posteriores,
-- emprendimientos y proyectos sociales.
--
-- Las tres tablas de datos son 1-a-N por diseño: un egresado puede tener
-- varios estudios, negocios o proyectos. El formulario público captura
-- solo uno de cada tipo por ahora, pero el esquema no lo limita.

USE egresados;

-- ---------------------------------------------------------------
-- 1. Primer empleo: empresa y puesto
--    Hoy solo se guarda cuánto tardó y por qué medio lo consiguió.
-- ---------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN primer_empleo_empresa VARCHAR(150) NULL
    COMMENT 'Empresa del primer empleo tras egresar. NULL = no capturado.'
    AFTER medio_primer_empleo_otro,
  ADD COLUMN primer_empleo_puesto VARCHAR(150) NULL
    COMMENT 'Puesto del primer empleo tras egresar. NULL = no capturado.'
    AFTER primer_empleo_empresa;

-- ---------------------------------------------------------------
-- 2. Catálogo: niveles de estudio posterior
-- ---------------------------------------------------------------
CREATE TABLE niveles_estudio (
  id_nivel_estudio INT NOT NULL AUTO_INCREMENT,
  clave            VARCHAR(20)  NOT NULL,
  descripcion      VARCHAR(80)  NOT NULL,
  orden            INT          NOT NULL,
  PRIMARY KEY (id_nivel_estudio),
  UNIQUE KEY uq_niveles_estudio_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO niveles_estudio (clave, descripcion, orden) VALUES
  ('especialidad',  'Especialidad',                1),
  ('maestria',      'Maestría',                    2),
  ('doctorado',     'Doctorado',                   3),
  ('diplomado',     'Diplomado o certificación',   4);

-- ---------------------------------------------------------------
-- 3. Catálogo: estado de un estudio
-- ---------------------------------------------------------------
CREATE TABLE estados_estudio (
  id_estado_estudio INT NOT NULL AUTO_INCREMENT,
  clave             VARCHAR(20) NOT NULL,
  descripcion       VARCHAR(40) NOT NULL,
  orden             INT         NOT NULL,
  PRIMARY KEY (id_estado_estudio),
  UNIQUE KEY uq_estados_estudio_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO estados_estudio (clave, descripcion, orden) VALUES
  ('en_curso',  'En curso',  1),
  ('concluido', 'Concluido', 2),
  ('trunco',    'Trunco',    3);

-- ---------------------------------------------------------------
-- 4. Catálogo: tipos de proyecto social
-- ---------------------------------------------------------------
CREATE TABLE tipos_proyecto_social (
  id_tipo_proyecto INT NOT NULL AUTO_INCREMENT,
  clave            VARCHAR(30) NOT NULL,
  descripcion      VARCHAR(80) NOT NULL,
  orden            INT         NOT NULL,
  PRIMARY KEY (id_tipo_proyecto),
  UNIQUE KEY uq_tipos_proyecto_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO tipos_proyecto_social (clave, descripcion, orden) VALUES
  ('voluntariado',   'Voluntariado',                1),
  ('comunitario',    'Proyecto comunitario',        2),
  ('asesoria',       'Asesoría técnica',            3),
  ('educacion',      'Educación',                   4),
  ('medio_ambiente', 'Medio ambiente',              5),
  ('salud',          'Salud',                       6),
  ('otro',           'Otro',                        7);

-- ---------------------------------------------------------------
-- 5. Catálogo: rangos de empleados de un emprendimiento
-- ---------------------------------------------------------------
CREATE TABLE rangos_empleados (
  id_rango_empleados INT NOT NULL AUTO_INCREMENT,
  clave              VARCHAR(20) NOT NULL,
  descripcion        VARCHAR(40) NOT NULL,
  orden              INT         NOT NULL,
  PRIMARY KEY (id_rango_empleados),
  UNIQUE KEY uq_rangos_empleados_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO rangos_empleados (clave, descripcion, orden) VALUES
  ('solo_yo',   'Solo yo',        1),
  ('2_5',       'De 2 a 5',       2),
  ('6_10',      'De 6 a 10',      3),
  ('mas_10',    'Más de 10',      4);

-- ---------------------------------------------------------------
-- 6. Estudios posteriores (1-a-N)
-- ---------------------------------------------------------------
CREATE TABLE egresado_estudios (
  id_estudio        INT NOT NULL AUTO_INCREMENT,
  id_egresado       INT NOT NULL,
  id_nivel_estudio  INT NOT NULL,
  nombre_programa   VARCHAR(150) NOT NULL,
  institucion       VARCHAR(150) NOT NULL,
  id_estado_estudio INT NOT NULL,
  anio              YEAR NULL COMMENT 'Año de conclusión o de inicio si sigue en curso',
  PRIMARY KEY (id_estudio),
  KEY idx_ee_egresado (id_egresado),
  KEY idx_ee_nivel (id_nivel_estudio),
  KEY idx_ee_estado (id_estado_estudio),
  CONSTRAINT fk_ee_egresado FOREIGN KEY (id_egresado)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_ee_nivel FOREIGN KEY (id_nivel_estudio)
    REFERENCES niveles_estudio (id_nivel_estudio) ON DELETE RESTRICT,
  CONSTRAINT fk_ee_estado FOREIGN KEY (id_estado_estudio)
    REFERENCES estados_estudio (id_estado_estudio) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------
-- 7. Emprendimientos (1-a-N)
-- ---------------------------------------------------------------
CREATE TABLE egresado_emprendimientos (
  id_emprendimiento  INT NOT NULL AUTO_INCREMENT,
  id_egresado        INT NOT NULL,
  nombre             VARCHAR(150) NOT NULL,
  giro               VARCHAR(150) NOT NULL,
  anio_inicio        YEAR NULL,
  sigue_operando     TINYINT(1) NOT NULL DEFAULT 1,
  id_rango_empleados INT NULL,
  PRIMARY KEY (id_emprendimiento),
  KEY idx_em_egresado (id_egresado),
  KEY idx_em_rango (id_rango_empleados),
  CONSTRAINT fk_em_egresado FOREIGN KEY (id_egresado)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_em_rango FOREIGN KEY (id_rango_empleados)
    REFERENCES rangos_empleados (id_rango_empleados) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------
-- 8. Proyectos sociales (1-a-N)
--    Participación REALIZADA, no intención de colaborar.
--    No confundir con las tablas colaboraciones / colaboracion_otro,
--    que registran en qué le gustaría colaborar con el ITD.
-- ---------------------------------------------------------------
CREATE TABLE egresado_proyectos_sociales (
  id_proyecto      INT NOT NULL AUTO_INCREMENT,
  id_egresado      INT NOT NULL,
  nombre           VARCHAR(200) NOT NULL,
  id_tipo_proyecto INT NOT NULL,
  anio             YEAR NULL,
  organizacion     VARCHAR(150) NULL,
  PRIMARY KEY (id_proyecto),
  KEY idx_eps_egresado (id_egresado),
  KEY idx_eps_tipo (id_tipo_proyecto),
  CONSTRAINT fk_eps_egresado FOREIGN KEY (id_egresado)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_eps_tipo FOREIGN KEY (id_tipo_proyecto)
    REFERENCES tipos_proyecto_social (id_tipo_proyecto) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;