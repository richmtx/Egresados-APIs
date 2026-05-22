import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class DashboardService {

  constructor(
    private dataSource: DataSource,
    private notificacionesService: NotificacionesService,
  ) { }

  async getResumen(): Promise<any> {

    // 1. KPIs principales
    const [kpis] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                                        AS total_egresados,
        SUM(e.revisado = 0)                                             AS pendientes_revision,
        ROUND(
          SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1
        )                                                               AS tasa_empleo,
        ROUND(AVG(e.satisfaccion_formacion), 2)                         AS satisfaccion_promedio,
        ROUND(
          SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1
        )                                                               AS pct_titulados,
        SUM(e.estatus_titulacion = 'Titulado')                          AS total_titulados
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
    `);

    // 2. Total encuestas respondidas (todos los registros = una encuesta)
    const [encuestas] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                                        AS total_respondidas,
        ROUND(COUNT(*) * 100.0 / NULLIF(
          (SELECT COUNT(*) FROM egresados), 0
        ), 1)                                                           AS pct_cobertura
      FROM egresados
      WHERE numero_control IS NOT NULL AND numero_control != ''
    `);

    // 3. Egresados por carrera (top 5)
    const porCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      GROUP BY c.nombre_carrera
      ORDER BY total DESC
      LIMIT 5
    `);

    // 4. Situación laboral general
    const situacionLaboral = await this.dataSource.query(`
      SELECT
        sl.situacion,
        COUNT(*) AS total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS porcentaje
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      GROUP BY sl.situacion
      ORDER BY total DESC
    `);

    // 5. Respuestas recibidas por mes (últimos 8 meses)
    const respuestasPorMes = await this.dataSource.query(`
  SELECT
    DATE_FORMAT(e.fecha_registro, '%Y-%m')  AS mes,
    DATE_FORMAT(e.fecha_registro, '%b %Y')  AS mes_label,
    COUNT(*)                                AS total
  FROM egresados e
  WHERE e.fecha_registro >= DATE_SUB(NOW(), INTERVAL 8 MONTH)
  GROUP BY
    DATE_FORMAT(e.fecha_registro, '%Y-%m'),
    DATE_FORMAT(e.fecha_registro, '%b %Y')
  ORDER BY mes ASC
`);

    // 6. Hombres vs Mujeres por año de egreso (últimos 5 años)
    const generosPorAnio = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        CASE g.genero
          WHEN 'masculino' THEN 'Hombre'
          WHEN 'femenino'  THEN 'Mujer'
          ELSE 'Otro'
        END                AS genero,
        COUNT(*)           AS total
      FROM egresados e
      LEFT JOIN generos g ON e.genero_id = g.id_genero
      WHERE e.anio_egreso >= YEAR(NOW()) - 4
      GROUP BY e.anio_egreso, g.genero
      ORDER BY e.anio_egreso ASC, g.genero
    `);

    // 7. Últimas 5 respuestas recibidas
    const ultimasRespuestas = await this.dataSource.query(`
      SELECT
        e.id_egresado,
        e.nombre_completo,
        e.fecha_registro,
        e.foto_url,
        e.revisado,
        c.nombre_carrera,
        g.genero
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      LEFT JOIN generos g ON e.genero_id = g.id_genero
      ORDER BY e.fecha_registro DESC
      LIMIT 10
    `);

    // 8. Notificaciones sin leer 
    const notificacionesSinLeer = await this.notificacionesService.findNoLeidas();
    const { total: totalNotificaciones } = await this.notificacionesService.countNoLeidas();

    // 9. Egresados registrados recientemente (últimos 5)
    const egresadosRecientes = await this.dataSource.query(`
      SELECT
        e.id_egresado,
        e.nombre_completo,
        e.fecha_registro,
        e.foto_url,
        c.nombre_carrera,
        g.genero
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      LEFT JOIN generos g ON e.genero_id = g.id_genero
      ORDER BY e.fecha_registro DESC
      LIMIT 10
    `);

    // 10. Resumen del periodo actual (mes en curso)
    const [periodoActual] = await this.dataSource.query(`
      SELECT
        COUNT(*) AS respuestas_este_mes
      FROM egresados e
      WHERE MONTH(e.fecha_registro) = MONTH(NOW())
        AND YEAR(e.fecha_registro)  = YEAR(NOW())
    `);

    const [periodoAnterior] = await this.dataSource.query(`
      SELECT
        COUNT(*) AS respuestas_mes_anterior
      FROM egresados e
      WHERE MONTH(e.fecha_registro) = MONTH(DATE_SUB(NOW(), INTERVAL 1 MONTH))
        AND YEAR(e.fecha_registro)  = YEAR(DATE_SUB(NOW(), INTERVAL 1 MONTH))
    `);

    const diff =
      Number(periodoActual.respuestas_este_mes) -
      Number(periodoAnterior.respuestas_mes_anterior);

    // 11. Pendientes de revisión (top 10 para el panel)
    const pendientesDetalle = await this.dataSource.query(`
      SELECT
        e.id_egresado,
        e.nombre_completo,
        e.fecha_registro,
        e.foto_url,
        c.nombre_carrera
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      WHERE e.revisado = 0
      ORDER BY e.fecha_registro DESC
      LIMIT 10
    `);

    // 12. Top destacados
    const [carreraTopEmpleo] = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        ROUND(
          SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1
        ) AS pct_empleados
      FROM egresados e
      LEFT JOIN carreras c          ON e.carrera_id           = c.id_carrera
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      WHERE e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera
      ORDER BY pct_empleados DESC
      LIMIT 1
    `);

    const [ciudadTopTrabajo] = await this.dataSource.query(`
      SELECT
        e.ciudad_trabajo,
        COUNT(*) AS total
      FROM egresados e
      WHERE e.ciudad_trabajo IS NOT NULL AND e.ciudad_trabajo != ''
      GROUP BY e.ciudad_trabajo
      ORDER BY total DESC
      LIMIT 1
    `);

    const [empresaTop] = await this.dataSource.query(`
  SELECT
    e.empresa,
    COUNT(*) AS total
  FROM egresados e
  WHERE e.empresa IS NOT NULL
    AND e.empresa != ''
    AND e.empresa NOT LIKE '%sin empleo%'
    AND e.empresa NOT LIKE '%desempleado%'
    AND e.empresa NOT LIKE '%no trabajo%'
    AND e.empresa NOT LIKE '%ninguna%'
  GROUP BY e.empresa
  ORDER BY total DESC
  LIMIT 1
`);

    const [anioTopTitulacion] = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        ROUND(
          SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1
        ) AS pct_titulados
      FROM egresados e
      WHERE e.carrera_id NOT IN (15, 16)
      GROUP BY e.anio_egreso
      ORDER BY pct_titulados DESC
      LIMIT 1
    `);

    // 13. Tabla resumen por carrera
    const resumenCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*)                                                              AS total,
        ROUND(
          SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1
        )                                                                     AS pct_empleados,
        ROUND(
          SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1
        )                                                                     AS pct_titulados,
        ROUND(AVG(e.satisfaccion_formacion), 2)                               AS satisfaccion_promedio
      FROM egresados e
      LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      WHERE e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera
      ORDER BY total DESC
    `);

    // Armar respuesta final
    return {
      kpis: {
        total_egresados: Number(kpis.total_egresados),
        pendientes_revision: Number(kpis.pendientes_revision),
        tasa_empleo: Number(kpis.tasa_empleo),
        satisfaccion_promedio: Number(kpis.satisfaccion_promedio),
        pct_titulados: Number(kpis.pct_titulados),
        total_titulados: Number(kpis.total_titulados),
        total_respondidas: Number(encuestas.total_respondidas),
        pct_cobertura: Number(encuestas.pct_cobertura),
      },
      graficas: {
        porCarrera,
        situacionLaboral,
        respuestasPorMes,
        generosPorAnio,
      },
      actividad: {
        ultimasRespuestas,
        egresadosRecientes,
        notificaciones: notificacionesSinLeer.slice(0, 5),
        totalNotificacionesSinLeer: totalNotificaciones,
      },
      periodo: {
        respuestas_este_mes: Number(periodoActual.respuestas_este_mes),
        respuestas_mes_anterior: Number(periodoAnterior.respuestas_mes_anterior),
        diferencia: diff,
        tendencia: diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal',
      },
      pendientesDetalle,
      topDestacados: {
        carrera_top_empleo: carreraTopEmpleo ?? null,
        ciudad_top_trabajo: ciudadTopTrabajo ?? null,
        empresa_top: empresaTop ?? null,
        anio_top_titulacion: anioTopTitulacion ?? null,
      },
      resumenCarrera,
    };
  }
}