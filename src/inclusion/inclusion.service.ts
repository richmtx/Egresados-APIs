import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

// ─────────────────────────────────────────────────────────────────────────────
// REPORTES DE INCLUSIÓN — datos personales SENSIBLES (LFPDPPP)
//
// Reglas de este servicio (no negociables):
//  · Solo agregados: COUNT + agrupadores (carrera, año, categoría). Ninguna
//    consulta selecciona id_egresado, nombre, correo, teléfono ni foto.
//  · Umbral k = 5 aplicado EN EL SQL, con supresión complementaria: todo
//    conteo desagregado sale envuelto en
//      CASE WHEN conteo < 5 OR (base - conteo) < 5 THEN NULL ELSE conteo END
//    donde `base` es el total del grupo. Así se oculta tanto el grupo pequeño
//    como su complemento (5 de 6 revelaría al 1 restante). El JSON ya sale
//    censurado; null = "oculto por protección de datos".
//  · Ningún método acepta parámetros: cada reporte tiene un corte fijo, para
//    que no se puedan combinar filtros y deducir casos individuales.
//  · Solo cuentan egresados con consintio_datos_sensibles = 1, aunque por
//    alguna falla existieran filas de personas que no consintieron.
// ─────────────────────────────────────────────────────────────────────────────

// Constante del servicio, NO viene de ninguna entrada del usuario.
const UMBRAL = 5;

const NOTA_UMBRAL =
  'Los grupos con menos de 5 personas, o cuyo complemento dentro del grupo sea menor a 5, se muestran como null para proteger la identidad de los egresados.';

// Conteo condicional: cuántas filas del grupo cumplen la condición.
const cuenta = (cond: string) => `COUNT(CASE WHEN ${cond} THEN 1 END)`;

// Conteo condicional con umbral y supresión complementaria, aplicados en SQL.
// `cond` define a quién se cuenta; `base` define el total del grupo del que
// `cond` es un subconjunto. Se muestra solo si conteo >= 5 Y base - conteo >= 5.
const cuentaConUmbral = (cond: string, base: string) =>
  `CASE WHEN ${cuenta(cond)} < ${UMBRAL}
          OR ${cuenta(base)} - ${cuenta(cond)} < ${UMBRAL}
        THEN NULL ELSE ${cuenta(cond)} END`;

// Bases de grupo. Los datos de inclusión solo existen para quien consintió,
// así que su base es "los que consintieron"; el país de nacimiento se captura
// a todos, así que su base es todo el grupo.
const BASE_CONSINTIERON = `e.consintio_datos_sensibles = 1`;
const BASE_TODOS = `1 = 1`;

// ── Condiciones por persona (alias `e` = egresados). Todas exigen consentimiento.
const ES_DISCAPACIDAD = `
  e.consintio_datos_sensibles = 1
  AND EXISTS (
    SELECT 1
    FROM egresado_discapacidad ed
    JOIN grados_dificultad gd ON gd.id_grado = ed.id_grado
    WHERE ed.id_egresado = e.id_egresado
      AND gd.cuenta_discapacidad = 1
  )`;

const respuestaSi = (columna: 'id_indigena' | 'id_habla_lengua' | 'id_afromexicano') => `
  e.consintio_datos_sensibles = 1
  AND EXISTS (
    SELECT 1
    FROM egresado_identidad ei
    JOIN respuestas_autoadscripcion ra ON ra.id_respuesta = ei.${columna}
    WHERE ei.id_egresado = e.id_egresado
      AND ra.clave = 'si'
  )`;

const ES_INDIGENA = respuestaSi('id_indigena');
const HABLA_LENGUA = respuestaSi('id_habla_lengua');
const ES_AFROMEXICANO = respuestaSi('id_afromexicano');

// País de nacimiento es texto libre: se normaliza (minúsculas, sin espacios
// sobrantes) y se excluyen las variantes comunes de México.
const NACIDO_FUERA_DE_MEXICO = `
  e.pais_nacimiento IS NOT NULL
  AND TRIM(e.pais_nacimiento) <> ''
  AND LOWER(TRIM(e.pais_nacimiento)) NOT IN
      ('mexico', 'méxico', 'mx', 'mex', 'méx', 'estados unidos mexicanos')`;

@Injectable()
export class InclusionService {

  constructor(private readonly dataSource: DataSource) { }

  private envolver<T>(datos: T) {
    return { umbral: UMBRAL, nota: NOTA_UMBRAL, datos };
  }

  // 1. RESUMEN
  async getResumen() {
    const [fila] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                                        AS total_egresados,
        ${cuenta('e.consintio_datos_sensibles = 1')}                    AS consintieron,
        ${cuenta('e.consintio_datos_sensibles <> 1')}                   AS no_consintieron,
        ${cuentaConUmbral(ES_DISCAPACIDAD, BASE_CONSINTIERON)}          AS personas_con_discapacidad,
        ${cuentaConUmbral(ES_INDIGENA, BASE_CONSINTIERON)}              AS se_consideran_indigenas,
        ${cuentaConUmbral(HABLA_LENGUA, BASE_CONSINTIERON)}             AS hablan_lengua_indigena,
        ${cuentaConUmbral(ES_AFROMEXICANO, BASE_CONSINTIERON)}          AS se_consideran_afromexicanos,
        ${cuentaConUmbral(NACIDO_FUERA_DE_MEXICO, BASE_TODOS)}          AS nacidos_fuera_de_mexico
      FROM egresados e
    `);

    return this.envolver(fila);
  }

  // 2. DISCAPACIDAD POR DOMINIO × GRADO
  // Se parte de la rejilla completa dominio × grado (catálogos), de modo que
  // todas las celdas aparecen y las ocultas salen como null.
  // Grupo = dominio; base = consentidos que respondieron ese dominio (suma de
  // todos sus grados). Una celda se muestra solo si conteo >= 5 y
  // base - conteo >= 5.
  async getDiscapacidadPorDominio() {
    const filas: {
      dominio: string; pregunta: string;
      grado: string; descripcion: string; total: number | null;
    }[] = await this.dataSource.query(`
      SELECT
        d.clave        AS dominio,
        d.pregunta     AS pregunta,
        g.clave        AS grado,
        g.descripcion  AS descripcion,
        CASE WHEN COUNT(ed.id_dominio) < ${UMBRAL}
                OR COALESCE(MAX(b.n), 0) - COUNT(ed.id_dominio) < ${UMBRAL}
             THEN NULL ELSE COUNT(ed.id_dominio) END AS total
      FROM discapacidad_dominios d
      CROSS JOIN grados_dificultad g
      LEFT JOIN (
        -- Base por dominio: consentidos que respondieron ese dominio
        SELECT ed2.id_dominio, COUNT(*) AS n
        FROM egresado_discapacidad ed2
        JOIN egresados e2 ON e2.id_egresado = ed2.id_egresado
                         AND e2.consintio_datos_sensibles = 1
        GROUP BY ed2.id_dominio
      ) b ON b.id_dominio = d.id_dominio
      LEFT JOIN egresado_discapacidad ed
             ON ed.id_dominio = d.id_dominio
            AND ed.id_grado   = g.id_grado
            AND EXISTS (
              SELECT 1 FROM egresados e
              WHERE e.id_egresado = ed.id_egresado
                AND e.consintio_datos_sensibles = 1
            )
      GROUP BY d.id_dominio, d.clave, d.pregunta, d.orden,
               g.id_grado, g.clave, g.descripcion, g.orden
      ORDER BY d.orden, g.orden
    `);

    // Solo reagrupa filas ya censuradas por el SQL; no calcula nada.
    const porDominio = new Map<string, {
      dominio: string; pregunta: string;
      grados: { grado: string; descripcion: string; total: number | null }[];
    }>();
    for (const f of filas) {
      if (!porDominio.has(f.dominio)) {
        porDominio.set(f.dominio, { dominio: f.dominio, pregunta: f.pregunta, grados: [] });
      }
      porDominio.get(f.dominio)!.grados.push({
        grado: f.grado, descripcion: f.descripcion, total: f.total,
      });
    }

    return this.envolver([...porDominio.values()]);
  }

  // 3. POR CARRERA
  // Todas las carreras del catálogo aparecen; las celdas < 5 salen como null.
  async getPorCarrera() {
    const filas = await this.dataSource.query(`
      SELECT
        c.nombre_carrera                                AS carrera,
        ${cuentaConUmbral(ES_DISCAPACIDAD, BASE_CONSINTIERON)}     AS personas_con_discapacidad,
        ${cuentaConUmbral(ES_INDIGENA, BASE_CONSINTIERON)}         AS se_consideran_indigenas,
        ${cuentaConUmbral(ES_AFROMEXICANO, BASE_CONSINTIERON)}     AS se_consideran_afromexicanos
      FROM carreras c
      LEFT JOIN egresados e ON e.carrera_id = c.id_carrera
      GROUP BY c.id_carrera, c.nombre_carrera
      ORDER BY c.nombre_carrera
    `);

    return this.envolver(filas);
  }

  // 4. POR AÑO DE EGRESO
  // Los años salen de TODOS los egresados registrados (no solo de quienes
  // consintieron), así la lista de años no revela quién consintió.
  async getPorAnioEgreso() {
    const filas = await this.dataSource.query(`
      SELECT
        e.anio_egreso                                   AS anio_egreso,
        ${cuentaConUmbral(ES_DISCAPACIDAD, BASE_CONSINTIERON)}     AS personas_con_discapacidad,
        ${cuentaConUmbral(ES_INDIGENA, BASE_CONSINTIERON)}         AS se_consideran_indigenas,
        ${cuentaConUmbral(ES_AFROMEXICANO, BASE_CONSINTIERON)}     AS se_consideran_afromexicanos
      FROM egresados e
      GROUP BY e.anio_egreso
      ORDER BY e.anio_egreso
    `);

    return this.envolver(filas);
  }
}
