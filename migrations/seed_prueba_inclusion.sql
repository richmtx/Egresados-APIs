-- seed_prueba_inclusion.sql
-- DATOS TEMPORALES para probar la pantalla de inclusión.
-- 40 egresados concentrados en 3 carreras, con datos sensibles variados.
-- Al final del archivo está el script de limpieza.
-- Todos los correos empiezan con 'zz.inclusion' para poder borrarlos.

USE egresados;

-- ---------------------------------------------------------------
-- 1. Insertar 40 egresados
--    Se reparten en 3 carreras (ids 1, 2, 3) y 2 años de egreso.
--    Todos consienten datos sensibles.
-- ---------------------------------------------------------------
INSERT INTO egresados
  (nombre_completo, genero_id, correo, telefono, ciudad_residencia,
   pais_nacimiento, carrera_id, anio_ingreso, periodo_ingreso, anio_egreso,
   nivel_ingles_id, empresa, ciudad_trabajo, fecha_registro, numero_control,
   linkedin, puesto_trabajo, coincidencia_laboral_id, estatus_titulacion,
   situacion_laboral_id, satisfaccion_formacion, certificacion_vigente_id,
   registro_completo, consintio_datos_sensibles, fecha_consentimiento_sensibles)
SELECT
  CONCAT('Prueba Inclusion ', n) AS nombre_completo,
  IF(n % 2 = 0, 1, 2) AS genero_id,
  CONCAT('zz.inclusion', n, '@test.com') AS correo,
  '6180000000', 'Durango, Durango',
  CASE WHEN n % 20 = 0 THEN 'Estados Unidos' ELSE 'México' END AS pais_nacimiento,
  CASE WHEN n <= 14 THEN 1 WHEN n <= 27 THEN 2 ELSE 3 END AS carrera_id,
  CASE WHEN n % 2 = 0 THEN 2016 ELSE 2017 END AS anio_ingreso,
  'Agosto - Diciembre',
  CASE WHEN n % 2 = 0 THEN 2021 ELSE 2022 END AS anio_egreso,
  2, 'Empresa Prueba', 'Durango, Durango', NOW(),
  CONCAT('ZZ', LPAD(n, 6, '0')),
  '', 'Puesto Prueba', 1, 'Titulado', 2, 4, 2,
  1, 1, NOW()
FROM (
  SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5
  UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10
  UNION SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15
  UNION SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20
  UNION SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25
  UNION SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30
  UNION SELECT 31 UNION SELECT 32 UNION SELECT 33 UNION SELECT 34 UNION SELECT 35
  UNION SELECT 36 UNION SELECT 37 UNION SELECT 38 UNION SELECT 39 UNION SELECT 40
) nums;

-- ---------------------------------------------------------------
-- 2. Autorizaciones (para que no queden huérfanos)
-- ---------------------------------------------------------------
INSERT INTO autorizaciones (id_egresado, autorizo_estadisticas, autorizo_contacto, autorizo_eventos)
SELECT id_egresado, 1, 0, 0
FROM egresados WHERE correo LIKE 'zz.inclusion%';

-- ---------------------------------------------------------------
-- 3. Respuestas de discapacidad: 6 filas por egresado.
--    Distribución pensada para que algunas celdas pasen el umbral
--    y otras no.
-- ---------------------------------------------------------------
INSERT INTO egresado_discapacidad (id_egresado, id_dominio, id_grado)
SELECT
  e.id_egresado,
  d.id_dominio,
  CASE
    -- 'ver': la mayoría sin dificultad, ~8 con mucha dificultad
    WHEN d.clave = 'ver'    AND e.id_egresado % 5 = 0 THEN 3
    WHEN d.clave = 'ver'    AND e.id_egresado % 7 = 0 THEN 2
    -- 'oir': unos pocos
    WHEN d.clave = 'oir'    AND e.id_egresado % 9 = 0 THEN 3
    -- 'caminar': un par (queda bajo el umbral a propósito)
    WHEN d.clave = 'caminar' AND e.id_egresado % 17 = 0 THEN 4
    -- 'recordar': algunos prefieren no declarar
    WHEN d.clave = 'recordar' AND e.id_egresado % 6 = 0 THEN 5
    ELSE 1
  END AS id_grado
FROM egresados e
CROSS JOIN discapacidad_dominios d
WHERE e.correo LIKE 'zz.inclusion%';

-- ---------------------------------------------------------------
-- 4. Identidad cultural
-- ---------------------------------------------------------------
INSERT INTO egresado_identidad
  (id_egresado, id_indigena, id_habla_lengua, lengua_indigena, id_afromexicano)
SELECT
  id_egresado,
  CASE WHEN id_egresado % 4 = 0 THEN 1 WHEN id_egresado % 11 = 0 THEN 3 ELSE 2 END,
  CASE WHEN id_egresado % 8 = 0 THEN 1 ELSE 2 END,
  CASE WHEN id_egresado % 8 = 0 THEN 'Tepehuano' ELSE NULL END,
  CASE WHEN id_egresado % 13 = 0 THEN 1 ELSE 2 END
FROM egresados WHERE correo LIKE 'zz.inclusion%';