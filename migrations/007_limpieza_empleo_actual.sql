-- 007_limpieza_empleo_actual.sql
-- 1) Columnas del empleo actual y linkedin pasan a nullable.
--    NULL significa "no aplica / no respondió". Ya no se guarda ''.
-- 2) Se convierten las cadenas vacías existentes a NULL.
-- 3) El nivel de estudio "Diplomado o certificación" pasa a "Diplomado":
--    las certificaciones profesionales se capturan aparte (etapa 2).

USE egresados;

-- ---------------------------------------------------------------
-- 1. Permitir NULL
-- ---------------------------------------------------------------
ALTER TABLE egresados
  MODIFY COLUMN empresa        VARCHAR(150) NULL,
  MODIFY COLUMN puesto_trabajo VARCHAR(150) NULL,
  MODIFY COLUMN ciudad_trabajo VARCHAR(120) NULL,
  MODIFY COLUMN linkedin       VARCHAR(255) NULL;

-- ---------------------------------------------------------------
-- 2. Cadenas vacías → NULL
-- ---------------------------------------------------------------
UPDATE egresados SET empresa        = NULL WHERE empresa        = '';
UPDATE egresados SET puesto_trabajo = NULL WHERE puesto_trabajo = '';
UPDATE egresados SET ciudad_trabajo = NULL WHERE ciudad_trabajo = '';
UPDATE egresados SET linkedin       = NULL WHERE linkedin       = '';

-- ---------------------------------------------------------------
-- 3. Catálogo de niveles de estudio
-- ---------------------------------------------------------------
UPDATE niveles_estudio
   SET descripcion = 'Diplomado'
 WHERE clave = 'diplomado';



USE egresados;

SET SQL_SAFE_UPDATES = 0;

UPDATE egresados SET empresa        = NULL WHERE empresa        = '';
UPDATE egresados SET puesto_trabajo = NULL WHERE puesto_trabajo = '';
UPDATE egresados SET ciudad_trabajo = NULL WHERE ciudad_trabajo = '';
UPDATE egresados SET linkedin       = NULL WHERE linkedin       = '';

UPDATE niveles_estudio
   SET descripcion = 'Diplomado'
 WHERE clave = 'diplomado';

SET SQL_SAFE_UPDATES = 1;