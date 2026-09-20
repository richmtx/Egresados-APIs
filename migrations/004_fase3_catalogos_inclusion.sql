-- 004_fase3_catalogos_inclusion.sql
-- Fase 3: catálogos de referencia para datos de inclusión.
-- Solo crea catálogos. No toca la tabla egresados ni guarda datos de personas.
--
-- El instrumento de discapacidad sigue el del Censo 2020 (INEGI),
-- basado en las preguntas del Grupo de Washington. Deliberadamente
-- NO pregunta por "discapacidad": mide grado de dificultad funcional.
-- La condición se deriva por regla en el backend.

USE egresados;

-- ---------------------------------------------------------------
-- 1. Dominios de dificultad funcional (6 preguntas del instrumento)
-- ---------------------------------------------------------------
CREATE TABLE discapacidad_dominios (
  id_dominio INT NOT NULL AUTO_INCREMENT,
  clave      VARCHAR(20)  NOT NULL COMMENT 'Identificador estable para el código',
  pregunta   VARCHAR(150) NOT NULL COMMENT 'Texto que ve el egresado',
  orden      INT          NOT NULL,
  PRIMARY KEY (id_dominio),
  UNIQUE KEY uq_discapacidad_dominios_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO discapacidad_dominios (clave, pregunta, orden) VALUES
  ('ver',        'Ver, aun usando lentes',                1),
  ('oir',        'Oír, aun usando aparato auditivo',      2),
  ('caminar',    'Caminar, subir o bajar escaleras',      3),
  ('recordar',   'Recordar o concentrarse',               4),
  ('autocuidado','Bañarse, vestirse o comer',             5),
  ('comunicar',  'Hablar o comunicarse',                  6);

-- ---------------------------------------------------------------
-- 2. Grados de dificultad
--    cuenta_discapacidad = 1 en los grados que, por regla del
--    instrumento, hacen que la persona se cuente como persona
--    con discapacidad. "Prefiero no declarar" NO cuenta, y es
--    distinto de no haber respondido (ausencia de fila).
-- ---------------------------------------------------------------
CREATE TABLE grados_dificultad (
  id_grado            INT NOT NULL AUTO_INCREMENT,
  clave               VARCHAR(20)  NOT NULL,
  descripcion         VARCHAR(100) NOT NULL,
  cuenta_discapacidad TINYINT(1)   NOT NULL DEFAULT 0,
  orden               INT          NOT NULL,
  PRIMARY KEY (id_grado),
  UNIQUE KEY uq_grados_dificultad_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO grados_dificultad (clave, descripcion, cuenta_discapacidad, orden) VALUES
  ('sin_dificultad',   'No tengo dificultad',          0, 1),
  ('poca_dificultad',  'Lo hago con poca dificultad',  0, 2),
  ('mucha_dificultad', 'Lo hago con mucha dificultad', 1, 3),
  ('no_puedo',         'No puedo hacerlo',             1, 4),
  ('no_declara',       'Prefiero no declarar',         0, 5);

-- ---------------------------------------------------------------
-- 3. Respuestas de autoadscripción (identidad cultural)
--    Catálogo compartido por las tres preguntas de identidad.
-- ---------------------------------------------------------------
CREATE TABLE respuestas_autoadscripcion (
  id_respuesta INT NOT NULL AUTO_INCREMENT,
  clave        VARCHAR(20) NOT NULL,
  descripcion  VARCHAR(60) NOT NULL,
  orden        INT         NOT NULL,
  PRIMARY KEY (id_respuesta),
  UNIQUE KEY uq_respuestas_autoadscripcion_clave (clave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO respuestas_autoadscripcion (clave, descripcion, orden) VALUES
  ('si',         'Sí',                    1),
  ('no',         'No',                    2),
  ('no_declara', 'Prefiero no declarar',  3);