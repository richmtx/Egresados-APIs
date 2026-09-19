-- 003_fase2_periodo_espacios.sql
-- Cambia el formato del ENUM de periodo_ingreso para incluir espacios.

USE egresados;

ALTER TABLE egresados
  MODIFY COLUMN periodo_ingreso
    ENUM('Enero - Junio','Agosto - Diciembre','No lo recuerdo') NULL
    COMMENT 'Período de ingreso. NULL = no capturado.';