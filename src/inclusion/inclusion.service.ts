import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UsuariosService } from '../usuarios/usuarios.service';

// ─────────────────────────────────────────────────────────────────────────────
// REPORTES DE INCLUSIÓN — datos personales SENSIBLES (LFPDPPP)
//
// Reglas de este servicio (no negociables):
//  · Solo agregados: COUNT + agrupadores (carrera, año, categoría). Ninguna
//    consulta selecciona id_egresado, nombre, correo, teléfono ni foto.
//  · Umbral k = 3 aplicado EN EL SQL: todo conteo desagregado sale envuelto en
//      CASE WHEN conteo > 0 AND conteo < 3 THEN NULL ELSE conteo END
//    Un conteo de 0 se muestra como 0 ("cero personas" es un dato, no algo
//    que ocultar); solo se oculta cuando hay entre 1 y 2 personas. Ya no se
//    aplica supresión complementaria (base - conteo): la pantalla de
//    Inclusión la usan dos personas del departamento de Vinculación dentro
//    de una sesión autenticada, no es un portal público de datos abiertos.
//  · Ningún método acepta parámetros: cada reporte tiene un corte fijo, para
//    que no se puedan combinar filtros y deducir casos individuales.
//  · Solo cuentan egresados con consintio_datos_sensibles = 1, aunque por
//    alguna falla existieran filas de personas que no consintieron.
// ─────────────────────────────────────────────────────────────────────────────

// Constante del servicio, NO viene de ninguna entrada del usuario.
const UMBRAL = 3;

const NOTA_UMBRAL =
  'Los conteos mayores que 0 pero menores a 3 se muestran como null para proteger la identidad de los egresados. Un conteo de 0 se muestra como 0: "cero personas" y "oculto" no son lo mismo.';

// Conteo condicional: cuántas filas del grupo cumplen la condición.
const cuenta = (cond: string) => `COUNT(CASE WHEN ${cond} THEN 1 END)`;

// Aplica el umbral a un conteo ya calculado (por ejemplo, una celda de una
// rejilla dominio × grado, o un COUNT(...) directo). Se oculta solo cuando
// el conteo es mayor que 0 y menor que el umbral; el 0 se muestra tal cual.
const celdaConUmbral = (expresionConteo: string) =>
  `CASE WHEN ${expresionConteo} > 0 AND ${expresionConteo} < ${UMBRAL}
        THEN NULL ELSE ${expresionConteo} END`;

// Conteo condicional con umbral, aplicado en SQL.
const cuentaConUmbral = (cond: string) => celdaConUmbral(cuenta(cond));

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

export interface DecadaCobertura {
  etiqueta: string;
  desde: number;
  hasta: number;
  total: number;
}

@Injectable()
export class InclusionService {

  private readonly logger = new Logger(InclusionService.name);

  // Las tres preguntas de identidad cultural comparten el catálogo
  // respuestas_autoadscripcion (si, no, no_declara).
  private readonly PREGUNTAS_IDENTIDAD: {
    clave: string; pregunta: string;
    columna: 'id_indigena' | 'id_habla_lengua' | 'id_afromexicano';
  }[] = [
    { clave: 'indigena', pregunta: 'De acuerdo con su cultura, ¿se considera indígena?', columna: 'id_indigena' },
    { clave: 'habla_lengua', pregunta: '¿Habla alguna lengua indígena?', columna: 'id_habla_lengua' },
    { clave: 'afromexicano', pregunta: 'De acuerdo con su cultura, ¿se considera afromexicano/a?', columna: 'id_afromexicano' },
  ];

  constructor(
    private readonly dataSource: DataSource,
    private readonly usuariosService: UsuariosService,
  ) { }

  private envolver<T>(datos: T) {
    return { umbral: UMBRAL, nota: NOTA_UMBRAL, datos };
  }

  // Décadas dinámicas entre anio_min y anio_max: cada una empieza en un año
  // múltiplo de 10, salvo la primera (empieza en anio_min si cae a media
  // década) y la última (termina en anio_max en vez del múltiplo de 10 + 9).
  // Ej. anio_min=2008, anio_max=2026 → "2008-2009", "2010-2019", "2020-2026".
  private calcularDecadas(anioMin: number | null, anioMax: number | null): Omit<DecadaCobertura, 'total'>[] {
    if (anioMin === null || anioMax === null) return [];
    const decadas: Omit<DecadaCobertura, 'total'>[] = [];
    let inicioDecada = Math.floor(anioMin / 10) * 10;
    while (inicioDecada <= anioMax) {
      const desde = Math.max(inicioDecada, anioMin);
      const hasta = Math.min(inicioDecada + 9, anioMax);
      decadas.push({ etiqueta: desde === hasta ? `${desde}` : `${desde}-${hasta}`, desde, hasta });
      inicioDecada += 10;
    }
    return decadas;
  }

  // 1. RESUMEN
  async getResumen() {
    const [fila] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                                        AS total_egresados,
        ${cuenta('e.consintio_datos_sensibles = 1')}                    AS consintieron,
        ${cuenta('e.consintio_datos_sensibles <> 1')}                   AS no_consintieron,
        ${cuentaConUmbral(ES_DISCAPACIDAD)}                             AS personas_con_discapacidad,
        ${cuentaConUmbral(ES_INDIGENA)}                                 AS se_consideran_indigenas,
        ${cuentaConUmbral(HABLA_LENGUA)}                                AS hablan_lengua_indigena,
        ${cuentaConUmbral(ES_AFROMEXICANO)}                             AS se_consideran_afromexicanos,
        ${cuentaConUmbral(NACIDO_FUERA_DE_MEXICO)}                      AS nacidos_fuera_de_mexico,
        MIN(e.anio_egreso)                                              AS anio_min,
        MAX(e.anio_egreso)                                              AS anio_max
      FROM egresados e
    `);

    // anio_min/anio_max salen de TODOS los egresados (no solo quienes
    // consintieron); la cobertura temporal no es un dato sensible.
    const anioMin = fila.anio_min === null ? null : Number(fila.anio_min);
    const anioMax = fila.anio_max === null ? null : Number(fila.anio_max);
    const decadas = this.calcularDecadas(anioMin, anioMax);

    let decadasConTotal: DecadaCobertura[] = [];
    if (decadas.length > 0) {
      const [sumaFila] = await this.dataSource.query(`
        SELECT
          ${decadas.map((d, i) =>
            `SUM(CASE WHEN anio_egreso BETWEEN ${d.desde} AND ${d.hasta} THEN 1 ELSE 0 END) AS d${i}`,
          ).join(',\n          ')}
        FROM egresados
      `);
      // total por década: no lleva umbral, cuenta a todos los egresados.
      decadasConTotal = decadas.map((d, i) => ({ ...d, total: Number(sumaFila[`d${i}`] ?? 0) }));
    }

    const { anio_min, anio_max, ...resto } = fila;

    return this.envolver({
      ...resto,
      cobertura: { anio_min: anioMin, anio_max: anioMax, decadas: decadasConTotal },
    });
  }

  // 2. DISCAPACIDAD POR DOMINIO × GRADO
  // Se parte de la rejilla completa dominio × grado (catálogos), de modo que
  // todas las celdas aparecen y las ocultas salen como null.
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
        ${celdaConUmbral('COUNT(ed.id_dominio)')} AS total
      FROM discapacidad_dominios d
      CROSS JOIN grados_dificultad g
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
  // Todas las carreras del catálogo aparecen; las celdas ocultas salen como null.
  // `consintieron` es la base de la fila (cuántos dieron consentimiento) y
  // NO lleva umbral: es un conteo exacto sobre el que se calculan los demás.
  async getPorCarrera() {
    const filas = await this.dataSource.query(`
      SELECT
        c.nombre_carrera                                AS carrera,
        ${cuenta('e.consintio_datos_sensibles = 1')}     AS consintieron,
        ${cuentaConUmbral(ES_DISCAPACIDAD)}     AS personas_con_discapacidad,
        ${cuentaConUmbral(ES_INDIGENA)}         AS se_consideran_indigenas,
        ${cuentaConUmbral(ES_AFROMEXICANO)}     AS se_consideran_afromexicanos
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
  // `consintieron` es la base de la fila (cuántos de ese año dieron
  // consentimiento) y NO lleva umbral: es un conteo exacto.
  async getPorAnioEgreso() {
    const filas = await this.dataSource.query(`
      SELECT
        e.anio_egreso                                   AS anio_egreso,
        ${cuenta('e.consintio_datos_sensibles = 1')}     AS consintieron,
        ${cuentaConUmbral(ES_DISCAPACIDAD)}     AS personas_con_discapacidad,
        ${cuentaConUmbral(ES_INDIGENA)}         AS se_consideran_indigenas,
        ${cuentaConUmbral(ES_AFROMEXICANO)}     AS se_consideran_afromexicanos
      FROM egresados e
      GROUP BY e.anio_egreso
      ORDER BY e.anio_egreso
    `);

    return this.envolver(filas);
  }

  // 5. IDENTIDAD POR PREGUNTA
  // Análogo a discapacidad-por-dominio: rejilla completa pregunta × respuesta
  // del catálogo respuestas_autoadscripcion, con el mismo umbral. El
  // desglose de lengua_indigena por lengua NO lleva umbral: es un conteo
  // global (no cruzado con carrera ni año) para una pantalla que solo usan
  // dos personas autenticadas del departamento, así que se muestra cada
  // lengua con su conteo real, sin agrupar en "Otras lenguas".
  async getIdentidadPorPregunta() {
    const datos: {
      pregunta_clave: string; pregunta: string;
      respuestas: { clave: string; descripcion: string; total: number | null }[];
    }[] = [];

    for (const p of this.PREGUNTAS_IDENTIDAD) {
      const respuestas = await this.dataSource.query(`
        SELECT
          ra.clave       AS clave,
          ra.descripcion AS descripcion,
          ${celdaConUmbral('COUNT(ei.id_egresado)')} AS total
        FROM respuestas_autoadscripcion ra
        LEFT JOIN egresado_identidad ei
               ON ei.${p.columna} = ra.id_respuesta
              AND EXISTS (
                SELECT 1 FROM egresados e
                WHERE e.id_egresado = ei.id_egresado
                  AND e.consintio_datos_sensibles = 1
              )
        GROUP BY ra.id_respuesta, ra.clave, ra.descripcion, ra.orden
        ORDER BY ra.orden
      `);
      datos.push({ pregunta_clave: p.clave, pregunta: p.pregunta, respuestas });
    }

    const lenguas: { lengua: string; total: number | string }[] = await this.dataSource.query(`
      SELECT ei.lengua_indigena AS lengua, COUNT(*) AS total
      FROM egresado_identidad ei
      JOIN egresados e
        ON e.id_egresado = ei.id_egresado
       AND e.consintio_datos_sensibles = 1
      JOIN respuestas_autoadscripcion ra
        ON ra.id_respuesta = ei.id_habla_lengua
       AND ra.clave = 'si'
      WHERE ei.lengua_indigena IS NOT NULL
        AND TRIM(ei.lengua_indigena) <> ''
      GROUP BY ei.lengua_indigena
      ORDER BY total DESC, lengua ASC
    `);

    // Sin umbral: cada lengua sale con su conteo real, ya ordenadas de
    // mayor a menor por el SQL.
    const lenguaIndigena: { lengua: string; total: number }[] =
      lenguas.map(l => ({ lengua: l.lengua, total: Number(l.total) }));

    return { umbral: UMBRAL, nota: NOTA_UMBRAL, datos, lengua_indigena: lenguaIndigena };
  }

  // 6. ESTADO DEL CONSENTIMIENTO (solo el estado, jamás las respuestas)
  async getConsentimiento(id: number) {
    const [fila] = await this.dataSource.query(
      `SELECT id_egresado, consintio_datos_sensibles, fecha_consentimiento_sensibles
       FROM egresados WHERE id_egresado = ?`,
      [id],
    );
    if (!fila) throw new NotFoundException('Egresado no encontrado.');

    return {
      id_egresado: fila.id_egresado,
      consintio: fila.consintio_datos_sensibles === 1,
      fecha_consentimiento: fila.fecha_consentimiento_sensibles ?? null,
    };
  }

  // 7. RETIRAR CONSENTIMIENTO (derechos ARCO)
  // Una sola transacción; si algo falla, rollback completo. La fila del
  // egresado se bloquea (FOR UPDATE) para que dos retiros simultáneos no
  // dupliquen el conteo ni la auditoría.
  async retirarConsentimiento(id: number, idAdmin: number) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    let filasEliminadas = 0;
    let teniaConsentimiento = false;
    try {
      const [egresado] = await qr.query(
        `SELECT consintio_datos_sensibles FROM egresados
         WHERE id_egresado = ? FOR UPDATE`,
        [id],
      );
      if (!egresado) throw new NotFoundException('Egresado no encontrado.');

      teniaConsentimiento = egresado.consintio_datos_sensibles === 1;

      // Los DELETE se ejecutan siempre: pueden existir filas huérfanas de
      // alguien cuyo consentimiento ya estaba en 0.
      const disc = await qr.query(
        `DELETE FROM egresado_discapacidad WHERE id_egresado = ?`, [id],
      );
      const ident = await qr.query(
        `DELETE FROM egresado_identidad WHERE id_egresado = ?`, [id],
      );
      if (teniaConsentimiento) {
        await qr.query(
          `UPDATE egresados
           SET consintio_datos_sensibles = 0, fecha_consentimiento_sensibles = NULL
           WHERE id_egresado = ?`,
          [id],
        );
      }

      filasEliminadas = (disc?.affectedRows ?? 0) + (ident?.affectedRows ?? 0);
      await qr.commitTransaction();
    } catch (err) {
      if (qr.isTransactionActive) await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }

    // Sin consentimiento previo y sin filas que borrar: nada cambió, no se audita.
    if (!teniaConsentimiento && filasEliminadas === 0) {
      return {
        mensaje: 'El egresado no tenía consentimiento vigente ni datos de inclusión que retirar.',
        filas_eliminadas: 0,
      };
    }

    // Auditoría posterior al commit. Solo el id: nada de nombre ni respuestas.
    // Si el registro falla, el retiro ya es efectivo: se deja constancia en el
    // log en vez de responder 500 por algo que sí se ejecutó.
    try {
      await this.usuariosService.registrarAccion(
        idAdmin,
        'retirar_consentimiento',
        `Retiró los datos de inclusión del egresado con ID ${id}`,
        'inclusion',
      );
    } catch (err) {
      this.logger.error(
        `Retiro aplicado al egresado ${id} pero falló el registro de auditoría`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return { mensaje: 'Datos de inclusión retirados.', filas_eliminadas: filasEliminadas };
  }
}
