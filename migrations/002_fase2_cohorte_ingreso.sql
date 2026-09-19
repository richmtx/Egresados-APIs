-- 002_fase2_cohorte_ingreso.sql
-- Fase 2: cohorte de ingreso (año y período).
-- Ambas columnas son NULL porque los registros existentes no tienen el dato.

USE egresados;

-- ---------------------------------------------------------------
-- 1. Columnas nuevas
--    Se colocan antes de anio_egreso para que el orden del esquema
--    refleje el orden real: primero ingresa, luego egresa.
-- ---------------------------------------------------------------
ALTER TABLE egresados
  ADD COLUMN anio_ingreso YEAR NULL
    COMMENT 'Año de ingreso al ITD. NULL = no capturado.'
    AFTER carrera_id,
  ADD COLUMN periodo_ingreso ENUM('Enero-Junio','Agosto-Diciembre','No lo recuerdo') NULL
    COMMENT 'Período de ingreso. NULL = no capturado.'
    AFTER anio_ingreso;

-- ---------------------------------------------------------------
-- 2. Índices para los reportes por cohorte
-- ---------------------------------------------------------------
ALTER TABLE egresados
  ADD INDEX idx_egresados_anio_ingreso    (anio_ingreso),
  ADD INDEX idx_egresados_cohorte_carrera (anio_ingreso, carrera_id);