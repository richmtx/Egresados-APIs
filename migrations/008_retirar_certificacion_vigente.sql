-- 008_retirar_certificacion_vigente.sql
-- Se retira la pregunta "certificación vigente" (Sí/No).
-- Los estudios posteriores (Fase 4) y las certificaciones profesionales
-- (tabla certificaciones, etapa 2) la sustituyen con datos reales.
-- NO afecta a la tabla `certificaciones`.

USE egresados;

ALTER TABLE egresados
  DROP FOREIGN KEY fk_egresados_certificacion_vigente;

ALTER TABLE egresados
  DROP COLUMN certificacion_vigente_id;

DROP TABLE certificaciones_vigentes;