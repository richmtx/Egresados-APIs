-- ============================================================================
-- 009_fase6_duplicados.sql
-- Fase 6 — Detección y fusión de duplicados
--
-- Crea DOS tablas:
--   1) duplicados_candidatos  -> lo que el sistema PROPONE (solo lectura)
--   2) duplicados_fusiones    -> lo que el administrador YA DECIDIÓ (auditoría)
--
-- El sistema NUNCA borra por su cuenta. El detector solo llena la tabla de
-- candidatos con un puntaje y las señales que lo explican. Un administrador
-- revisa el par, decide si son la misma persona y, si lo son, elige CUÁL de
-- los dos se conserva. Solo entonces se fusiona.
--
-- Este archivo es re-ejecutable: todo va con IF NOT EXISTS.
-- ============================================================================

USE egresados;


-- ============================================================================
-- TABLA 1 — duplicados_candidatos
--
-- Guarda pares sospechosos. El par SIEMPRE se almacena ordenado
-- (id_egresado_a < id_egresado_b) para que (12,45) y (45,12) sean la misma
-- fila: el CHECK obliga el orden y el UNIQUE impide repetir el par.
--
-- Al re-ejecutar el detector, los pares ya 'confirmado' o 'descartado' NO
-- deben regresar a 'pendiente'. Eso se resuelve en el código con
-- INSERT ... ON DUPLICATE KEY UPDATE tocando score y señales únicamente
-- cuando estado = 'pendiente'.
--
-- OJO con el borrado en cascada: cuando se fusiona un par, el egresado
-- perdedor se elimina y esta fila de candidato desaparece sola por la FK.
-- Eso es correcto y buscado: el par ya no existe. El rastro permanente
-- de esa fusión vive en duplicados_fusiones, que a propósito NO tiene FK
-- hacia el registro eliminado.
-- ============================================================================

CREATE TABLE IF NOT EXISTS duplicados_candidatos (
  id_candidato            INT NOT NULL AUTO_INCREMENT,

  id_egresado_a           INT NOT NULL
                          COMMENT 'Siempre el id MENOR del par',
  id_egresado_b           INT NOT NULL
                          COMMENT 'Siempre el id MAYOR del par',

  score                   TINYINT UNSIGNED NOT NULL DEFAULT 0
                          COMMENT 'Puntaje 0-100 calculado por el detector',

  -- Señales individuales. El panel las muestra para explicar POR QUÉ este par
  -- es candidato. El administrador decide viendo las señales, no el puntaje.
  coincide_num_control    TINYINT(1) NOT NULL DEFAULT 0
                          COMMENT 'Mismo numero_control normalizado (sin c, guiones ni espacios)',
  coincide_correo         TINYINT(1) NOT NULL DEFAULT 0
                          COMMENT 'Misma parte local del correo. El correo exacto no puede repetirse: la columna es UNIQUE',
  coincide_telefono       TINYINT(1) NOT NULL DEFAULT 0
                          COMMENT 'Mismos ultimos 10 digitos del telefono',
  coincide_nombre         TINYINT(1) NOT NULL DEFAULT 0
                          COMMENT 'Mismo nombre normalizado (sin acentos, minusculas, espacios colapsados)',
  coincide_carrera        TINYINT(1) NOT NULL DEFAULT 0
                          COMMENT 'Misma carrera_id',
  similitud_nombre        TINYINT UNSIGNED NOT NULL DEFAULT 0
                          COMMENT 'Parecido entre nombres 0-100 (para nombres escritos distinto)',
  diferencia_anios        TINYINT UNSIGNED NULL
                          COMMENT 'Valor absoluto de la diferencia entre anio_egreso',

  estado ENUM('pendiente','confirmado','descartado')
                          NOT NULL DEFAULT 'pendiente'
                          COMMENT 'pendiente = por revisar | confirmado = son la misma persona | descartado = son personas distintas',

  id_egresado_conservado  INT NULL
                          COMMENT 'Cual de los dos eligio conservar el administrador. NULL mientras no se resuelva',

  detectado_en            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revisado_por            VARCHAR(100) NULL
                          COMMENT 'Administrador que resolvio el caso. Mismo formato que egresados.revisado_por',
  revisado_en             DATETIME NULL,
  notas                   VARCHAR(500) NULL
                          COMMENT 'Por que se descarto o se confirmo',

  PRIMARY KEY (id_candidato),
  UNIQUE KEY uq_duplicados_par (id_egresado_a, id_egresado_b),
  KEY idx_duplicados_estado (estado),
  KEY idx_duplicados_estado_score (estado, score),
  KEY idx_duplicados_b (id_egresado_b),
  KEY idx_duplicados_conservado (id_egresado_conservado),

  CONSTRAINT chk_duplicados_orden
    CHECK (id_egresado_a < id_egresado_b),

  CONSTRAINT fk_dup_egresado_a FOREIGN KEY (id_egresado_a)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_dup_egresado_b FOREIGN KEY (id_egresado_b)
    REFERENCES egresados (id_egresado) ON DELETE CASCADE,
  CONSTRAINT fk_dup_conservado FOREIGN KEY (id_egresado_conservado)
    REFERENCES egresados (id_egresado) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Pares de egresados que el sistema propone como posibles duplicados. No fusiona nada por si sola.';


-- Ajuste para quienes ya crearon la tabla con revisado_por INT.
-- Es idempotente: si ya es VARCHAR(100), no pasa nada.
ALTER TABLE duplicados_candidatos
  MODIFY COLUMN revisado_por VARCHAR(100) NULL
  COMMENT 'Administrador que resolvio el caso. Mismo formato que egresados.revisado_por';


-- ============================================================================
-- TABLA 2 — duplicados_fusiones
--
-- Bitácora permanente. Se escribe UNA fila cada vez que un administrador
-- fusiona dos registros, dentro de la misma transacción que hace el borrado.
--
-- Guarda el registro eliminado COMPLETO en JSON (con todos sus hijos) antes
-- de borrarlo, para que nunca se pierda información y se pueda reconstruir
-- si alguien se equivoca.
--
-- id_egresado_eliminado NO tiene llave foránea a propósito: ese registro ya
-- no existe en egresados. Si la tuviera, esta bitácora se borraría sola y
-- perderíamos justo lo que queremos conservar.
-- ============================================================================

CREATE TABLE IF NOT EXISTS duplicados_fusiones (
  id_fusion                 INT NOT NULL AUTO_INCREMENT,

  id_egresado_conservado    INT NULL
                            COMMENT 'El registro que sobrevivio. NULL si despues se elimino por otra via',
  id_egresado_eliminado     INT NOT NULL
                            COMMENT 'El id que TENIA el registro borrado. Sin FK: ese registro ya no existe',

  -- Copia legible del eliminado, para poder buscarlo sin abrir el JSON
  nombre_eliminado          VARCHAR(150) NOT NULL,
  correo_eliminado          VARCHAR(120) NOT NULL,
  numero_control_eliminado  VARCHAR(20)  NOT NULL,

  snapshot                  JSON NOT NULL
                            COMMENT 'Registro eliminado completo + todos sus hijos, tal como estaban antes del borrado',
  hijos_reasignados         JSON NULL
                            COMMENT 'Cuantos hijos se movieron al conservado, por tabla. Ej: {"certificaciones":3,"egresado_estudios":1}',
  campos_completados        JSON NULL
                            COMMENT 'Campos vacios del conservado que se rellenaron con datos del eliminado. Ej: {"linkedin":"...","ciudad_trabajo":"..."}',

  id_candidato              INT NULL
                            COMMENT 'De que candidato salio esta fusion. Sin FK: esa fila se borra en cascada al fusionar',
  fusionado_por             VARCHAR(100) NULL
                            COMMENT 'Administrador que autorizo la fusion',
  fusionado_en              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notas                     VARCHAR(500) NULL
                            COMMENT 'Por que se eligio conservar ese y no el otro',

  PRIMARY KEY (id_fusion),
  KEY idx_fusiones_conservado (id_egresado_conservado),
  KEY idx_fusiones_eliminado (id_egresado_eliminado),
  KEY idx_fusiones_fecha (fusionado_en),
  KEY idx_fusiones_num_control (numero_control_eliminado),

  CONSTRAINT fk_fusion_conservado FOREIGN KEY (id_egresado_conservado)
    REFERENCES egresados (id_egresado) ON DELETE SET NULL
) ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Bitacora permanente de fusiones. Conserva el registro eliminado completo en JSON.';


-- ============================================================================
-- VERIFICACIÓN
-- Corre cada instrucción por separado con Ctrl+Enter.
-- ============================================================================

-- Las dos tablas existen
SHOW TABLES LIKE 'duplicados%';

-- Definición completa (clic derecho en la celda -> Open Value in Viewer)
SHOW CREATE TABLE duplicados_candidatos;
SHOW CREATE TABLE duplicados_fusiones;

-- revisado_por quedó como VARCHAR(100)
SHOW COLUMNS FROM duplicados_candidatos LIKE 'revisado_por';

-- Ambas arrancan vacías
SELECT
  (SELECT COUNT(*) FROM duplicados_candidatos) AS candidatos,
  (SELECT COUNT(*) FROM duplicados_fusiones)   AS fusiones;