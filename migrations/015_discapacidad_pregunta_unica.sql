-- =============================================================================
-- 015_discapacidad_pregunta_unica.sql
-- Discapacidad: de seis preguntas a una sola con severidad por dominio
--
-- Vinculación pidió que las seis preguntas del conjunto breve del Grupo de
-- Washington se presenten como UNA sola pregunta, y que se retire el dominio
-- de autocuidado ("Bañarse, vestirse o comer").
--
-- Se conserva la severidad por dominio (poca / mucha / no puedo), que es lo
-- que alimenta la columna grados_dificultad.cuenta_discapacidad y, con ella,
-- toda la lógica de la pantalla de Inclusión.
--
-- A partir de este cambio, egresado_discapacidad guarda SOLO los dominios que
-- el egresado marcó. Antes guardaba las seis filas siempre, incluidas las de
-- "sin dificultad". No marcar nada ahora significa no tener filas.
--
-- Fecha: 2026-10-14
-- Autor: Ricardo Martínez (CIT - ITD)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Dominios activos e inactivos
-- -----------------------------------------------------------------------------
-- El dominio de autocuidado se desactiva, NO se borra: así las respuestas que
-- existan siguen siendo legibles y el dominio puede reactivarse si algún día
-- lo vuelven a pedir. Borrarlo además fallaría por la FK de
-- egresado_discapacidad.

ALTER TABLE discapacidad_dominios
  ADD COLUMN activo TINYINT(1) NOT NULL DEFAULT 1
  COMMENT 'Si es 0, el dominio ya no se pregunta en el formulario'
  AFTER orden;

UPDATE discapacidad_dominios
SET activo = 0
WHERE clave = 'autocuidado';

-- -----------------------------------------------------------------------------
-- 2. Texto libre de la opción "Otra"
-- -----------------------------------------------------------------------------
-- Sigue la convención de habilidades_otro y colaboracion_otro: id_otro como
-- llave, id_egresado con FK en cascada, descripcion.
--
-- Dos diferencias deliberadas con esas dos tablas: aquí id_egresado y
-- descripcion son NOT NULL, y hay UNIQUE por egresado. Un texto "Otra" sin
-- egresado no significa nada, y la pregunta tiene un solo campo de texto, así
-- que no puede haber dos por persona.

CREATE TABLE discapacidad_otro (
  id_otro INT AUTO_INCREMENT PRIMARY KEY,
  id_egresado INT NOT NULL,
  descripcion VARCHAR(200) NOT NULL,

  UNIQUE KEY uq_discapacidad_otro_egresado (id_egresado),

  CONSTRAINT fk_discapacidad_otro_egresado
    FOREIGN KEY (id_egresado) REFERENCES egresados(id_egresado) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Texto libre de la opcion "Otra" de la pregunta de discapacidad (015)';


-- =============================================================================
-- NOTA SOBRE LOS DATOS ACTUALES
-- =============================================================================
-- Las filas que ya existen en egresado_discapacidad son de la semilla y
-- traen los seis dominios por egresado, la mayoría con sin_dificultad. No se
-- borran aquí: la regeneración de la semilla (paso 2.5) las reemplaza con el
-- formato nuevo. No hay egresados reales capturados todavía.
--
-- Los grados sin_dificultad y no_declara dejan de usarse: "sin dificultad" es
-- ahora no marcar la casilla, y el selector de severidad obliga a elegir. Las
-- filas del catálogo se quedan sin tocar.
-- =============================================================================


-- =============================================================================
-- ROLLBACK (no correr salvo que haya que deshacer la migración)
-- =============================================================================
-- DROP TABLE discapacidad_otro;
--
-- ALTER TABLE discapacidad_dominios DROP COLUMN activo;
-- =============================================================================