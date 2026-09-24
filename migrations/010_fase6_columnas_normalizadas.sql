-- ============================================================================
-- 010_fase6_columnas_normalizadas.sql
-- Fase 6 — Columnas normalizadas para comparar egresados
--
-- Agrega a `egresados` cuatro columnas GENERADAS. MySQL las calcula solo a
-- partir de las columnas que ya existen, se actualizan solas cuando cambia el
-- dato original, y NO se pueden insertar ni actualizar a mano.
--
-- Sirven para que el detector compare manzanas con manzanas:
--   "C19041234", "19041234" y "19-04-1234"  ->  todas 19041234
--   "618 832 11 85", "+52 618 8321185"      ->  ambas 6188321185
--
-- IMPORTANTE para el código NestJS: si algún día agregas estas columnas a la
-- entidad de TypeORM, márcalas con { insert: false, update: false }. Si no,
-- cualquier INSERT o UPDATE truena con el error 3105 (The value specified for
-- generated column is not allowed).
--
-- Esta migración NO es re-ejecutable: MySQL no soporta ADD COLUMN IF NOT
-- EXISTS. Si necesitas repetirla, primero corre el bloque de ROLLBACK que
-- está comentado hasta abajo.
-- ============================================================================

USE egresados;


-- ----------------------------------------------------------------------------
-- 1. numero_control normalizado
--    Quita guiones, espacios, puntos y guiones bajos; pasa a mayúsculas y
--    elimina la(s) "C" del inicio. Los valores basura quedan en NULL para que
--    nunca se usen como identificador.
-- ----------------------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN numero_control_norm VARCHAR(20)
    GENERATED ALWAYS AS (
      CASE
        WHEN UPPER(TRIM(numero_control)) IN
             ('DESCONOCIDO','N/A','NA','SIN NUMERO','SIN NUMERO DE CONTROL','NINGUNO','')
          THEN NULL
        ELSE NULLIF(
               TRIM(LEADING 'C' FROM
                 UPPER(
                   REPLACE(REPLACE(REPLACE(REPLACE(
                     numero_control, '-', ''), ' ', ''), '.', ''), '_', '')
                 )
               ), '')
      END
    ) STORED
    COMMENT 'numero_control sin C inicial, guiones ni espacios. NULL si es basura';


-- ----------------------------------------------------------------------------
-- 2. telefono normalizado
--    Deja solo los últimos 10 dígitos, así "+52 618 832 11 85" y
--    "6188321185" se reconocen como el mismo teléfono.
--    Si después de limpiar quedan menos de 10 dígitos, queda NULL.
-- ----------------------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN telefono_norm VARCHAR(10)
    GENERATED ALWAYS AS (
      CASE
        WHEN CHAR_LENGTH(
               REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                 telefono, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', '')
             ) >= 10
          THEN RIGHT(
                 REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                   telefono, ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), '.', ''),
                 10)
        ELSE NULL
      END
    ) STORED
    COMMENT 'Ultimos 10 digitos del telefono. NULL si no alcanzan 10';


-- ----------------------------------------------------------------------------
-- 3. nombre normalizado
--    Minúsculas, sin espacios de sobra y sin espacios dobles.
--    No hace falta quitar acentos: la colación utf8mb4_0900_ai_ci ya es
--    insensible a acentos, así que "Martínez" = "Martinez" al comparar.
-- ----------------------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN nombre_norm VARCHAR(150)
    GENERATED ALWAYS AS (
      LOWER(TRIM(
        REPLACE(REPLACE(REPLACE(REPLACE(
          nombre_completo, '  ', ' '), '  ', ' '), '  ', ' '), '  ', ' ')
      ))
    ) STORED
    COMMENT 'nombre_completo en minusculas, sin espacios dobles ni de sobra';


-- ----------------------------------------------------------------------------
-- 4. parte local del correo normalizada
--    Toma lo que va antes de la @, le quita la etiqueta +algo y los puntos.
--    Como la columna `correo` es UNIQUE, dos egresados NUNCA pueden tener el
--    mismo correo exacto. Pero sí pueden tener el mismo usuario en dominios
--    distintos, y eso es una señal fuerte de duplicado:
--      ricardo.mtz@gmail.com  y  ricardomtz@hotmail.com  ->  ambos "ricardomtz"
-- ----------------------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN correo_local_norm VARCHAR(120)
    GENERATED ALWAYS AS (
      NULLIF(
        LOWER(REPLACE(
          SUBSTRING_INDEX(SUBSTRING_INDEX(correo, '@', 1), '+', 1),
          '.', '')),
        '')
    ) STORED
    COMMENT 'Usuario del correo sin puntos ni etiqueta +algo. El correo completo es UNIQUE';


-- ----------------------------------------------------------------------------
-- 5. Índices para que el detector no barra la tabla completa
-- ----------------------------------------------------------------------------
ALTER TABLE egresados
  ADD INDEX idx_egresados_nc_norm      (numero_control_norm),
  ADD INDEX idx_egresados_tel_norm     (telefono_norm),
  ADD INDEX idx_egresados_nombre_norm  (nombre_norm),
  ADD INDEX idx_egresados_correo_norm  (correo_local_norm);


-- ============================================================================
-- ROLLBACK (solo si necesitas volver a correr esta migración)
-- Descomenta y ejecuta:
--
-- ALTER TABLE egresados
--   DROP INDEX idx_egresados_nc_norm,
--   DROP INDEX idx_egresados_tel_norm,
--   DROP INDEX idx_egresados_nombre_norm,
--   DROP INDEX idx_egresados_correo_norm;
--
-- ALTER TABLE egresados
--   DROP COLUMN numero_control_norm,
--   DROP COLUMN telefono_norm,
--   DROP COLUMN nombre_norm,
--   DROP COLUMN correo_local_norm;
-- ============================================================================