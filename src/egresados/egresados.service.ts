import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Egresado } from './egresados.entity';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';
import { NotificacionesService } from '../notificaciones/notificaciones.service';

@Injectable()
export class EgresadosService {

  constructor(
    @InjectRepository(Egresado)
    private egresadosRepo: Repository<Egresado>,
    private dataSource: DataSource,
    private notificacionesService: NotificacionesService,
  ) { }

  private async resolveId(
    tabla: string,
    columnaId: string,
    columnaTexto: string,
    valor: string,
  ): Promise<number> {
    const rows = await this.dataSource.query(
      `SELECT ${columnaId} FROM ${tabla} WHERE ${columnaTexto} = ? LIMIT 1`,
      [valor],
    );
    if (!rows.length) {
      throw new BadRequestException(
        `Valor "${valor}" no encontrado en la tabla ${tabla}.`,
      );
    }
    return rows[0][columnaId];
  }

  private async generarNotificacionDestacada(
    id_egresado: number,
    nombre: string,
    carrera: string,
    anio: number,
    ciudadTrabajo: string,
    ciudadResidencia: string,
    autorizoContacto: boolean,
    autorizoEventos: boolean,
  ): Promise<void> {

    const certs = await this.dataSource.query(
      `SELECT nombre_certificacion FROM certificaciones WHERE id_egresado = ? LIMIT 1`,
      [id_egresado],
    );

    const puestoRow = await this.dataSource.query(
      `SELECT puesto_trabajo FROM egresados WHERE id_egresado = ? LIMIT 1`,
      [id_egresado],
    );
    const puesto: string = puestoRow[0]?.puesto_trabajo || '';

    const opciones: { tipo: string; titulo: string; descripcion: string }[] = [];

    if (certs.length > 0) {
      const cert: string = certs[0].nombre_certificacion;
      const nombreCorto = nombre.split(' ').slice(0, 2).join(' ');
      opciones.push({
        tipo: 'nueva_encuesta',
        titulo: 'Encuesta destacada — Certificación',
        descripcion: `${nombreCorto} con certificación ${cert} completó la encuesta (${carrera}, ${anio})`,
      });
    }

    if (puesto && puesto.trim() !== '') {
      const nombreCorto = nombre.split(' ').slice(0, 2).join(' ');
      opciones.push({
        tipo: 'nueva_encuesta',
        titulo: 'Encuesta destacada — Puesto laboral',
        descripcion: `${nombreCorto}, ${puesto} completó la encuesta (${carrera}, ${anio})`,
      });
    }

    if (
      ciudadTrabajo &&
      ciudadTrabajo.trim() !== '' &&
      ciudadTrabajo.toLowerCase() !== ciudadResidencia.toLowerCase()
    ) {
      const nombreCorto = nombre.split(' ').slice(0, 2).join(' ');
      opciones.push({
        tipo: 'nueva_encuesta',
        titulo: 'Encuesta destacada — Ubicación',
        descripcion: `${nombreCorto} trabajando actualmente en ${ciudadTrabajo} completó la encuesta (${carrera}, ${anio})`,
      });
    }

    if (autorizoContacto) {
      opciones.push({
        tipo: 'contacto',
        titulo: 'Nuevo egresado disponible',
        descripcion: `${nombre} autorizó contacto para ofertas laborales — ${carrera}, generación ${anio}`,
      });
    }

    if (autorizoEventos) {
      opciones.push({
        tipo: 'eventos',
        titulo: 'Egresado disponible para eventos',
        descripcion: `${nombre} autorizó participar en actividades académicas y eventos institucionales`,
      });
    }

    if (opciones.length === 0) {
      opciones.push({
        tipo: 'nueva_encuesta',
        titulo: 'Nueva encuesta recibida',
        descripcion: `${nombre} completó la encuesta (${carrera}, ${anio})`,
      });
    }

    const elegida = opciones[Math.floor(Math.random() * opciones.length)];

    await this.notificacionesService.crear({
      tipo: elegida.tipo,
      titulo: elegida.titulo,
      descripcion: elegida.descripcion,
      id_egresado,
    });
  }

  // ETAPA 1
  async crearEtapa1(dto: CreateEgresadoEtapa1Dto): Promise<{ id_egresado: number; mensaje: string }> {

    const genero_id = await this.resolveId('generos', 'id_genero', 'genero', dto.genero);
    const carrera_id = await this.resolveId('carreras', 'id_carrera', 'nombre_carrera', dto.carrera);
    const nivel_ingles_id = await this.resolveId('niveles_ingles', 'id_nivel', 'nivel', dto.nivel_ingles);
    const situacion_laboral_id = await this.resolveId('situacion_laboral', 'id_situacion', 'situacion', dto.situacion_laboral);
    const antiguedad_empleo_id = await this.resolveId('antiguedad_empleo', 'id_antiguedad', 'rango', dto.antiguedad_empleo);
    const certificacion_vigente_id = await this.resolveId('certificaciones_vigentes', 'id_certificacion_vigente', 'respuesta', dto.certificacion_vigente);

    const result = await this.dataSource.query(
      `INSERT INTO egresados
      (nombre_completo, genero_id, correo, telefono, ciudad_residencia,
       carrera_id, anio_egreso, estatus_titulacion, certificacion_vigente_id,
       nivel_ingles_id, situacion_laboral_id, empresa, antiguedad_empleo_id,
       ciudad_trabajo, satisfaccion_formacion, fecha_registro,
       numero_control, linkedin, puesto_trabajo, coincidencia_laboral_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), '', '', '', 1)`,
      [
        dto.nombre_completo,
        genero_id,
        dto.correo,
        dto.telefono,
        dto.ciudad_residencia,
        carrera_id,
        dto.anio_egreso,
        dto.estatus_titulacion,
        certificacion_vigente_id,
        nivel_ingles_id,
        situacion_laboral_id,
        dto.empresa || '',
        antiguedad_empleo_id,
        dto.ciudad_trabajo || '',
        dto.satisfaccion_formacion,
      ],
    );

    const id_egresado: number = result.insertId;

    await this.dataSource.query(
      `INSERT INTO autorizaciones
      (id_egresado, autorizo_estadisticas, autorizo_contacto, autorizo_eventos)
     VALUES (?, ?, ?, ?)`,
      [
        id_egresado,
        dto.autorizaciones.estadisticas ? 1 : 0,
        dto.autorizaciones.contacto ? 1 : 0,
        dto.autorizaciones.eventos ? 1 : 0,
      ],
    );

    if (dto.autorizaciones.contacto) {
      await this.notificacionesService.crear({
        tipo: 'contacto',
        titulo: 'Egresado autorizó contacto',
        descripcion: `${dto.nombre_completo} autorizó ser contactado para oportunidades laborales`,
        id_egresado,
      });
    }

    if (dto.autorizaciones.eventos) {
      await this.notificacionesService.crear({
        tipo: 'eventos',
        titulo: 'Egresado autorizó participación en eventos',
        descripcion: `${dto.nombre_completo} autorizó ser contactado para participar en actividades académicas y eventos institucionales`,
        id_egresado,
      });
    }

    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*) AS total FROM egresados`
    );
    const total: number = parseInt(totalRows[0].total, 10);

    if (total % 5 === 0) {
      await this.generarNotificacionDestacada(
        id_egresado,
        dto.nombre_completo,
        dto.carrera,
        dto.anio_egreso,
        dto.ciudad_trabajo || '',
        dto.ciudad_residencia,
        dto.autorizaciones.contacto,
        dto.autorizaciones.eventos,
      );
    }

    return { id_egresado, mensaje: 'Etapa 1 guardada correctamente.' };
  }

  // ETAPA 2
  async completarEtapa2(
    id_egresado: number,
    dto: CreateEgresadoEtapa2Dto,
  ): Promise<{ mensaje: string }> {

    const existe = await this.egresadosRepo.findOne({ where: { id_egresado } });
    if (!existe) {
      throw new NotFoundException(`No se encontró el egresado con id ${id_egresado}.`);
    }

    const coincidencia_laboral_id = await this.resolveId(
      'coincidencia_laboral', 'id_coincidencia', 'nivel', dto.coincidencia_laboral,
    );

    await this.dataSource.query(
      `UPDATE egresados
         SET numero_control          = ?,
             linkedin                = ?,
             puesto_trabajo          = ?,
             coincidencia_laboral_id = ?
       WHERE id_egresado = ?`,
      [
        dto.numero_control,
        dto.linkedin || '',
        dto.puesto_trabajo || '',
        coincidencia_laboral_id,
        id_egresado,
      ],
    );

    if (dto.certificaciones && dto.certificaciones.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO certificaciones (id_egresado, nombre_certificacion) VALUES (?, ?)`,
        [id_egresado, dto.certificaciones.trim()],
      );
    }

    for (const hab of dto.habilidades) {
      const rows = await this.dataSource.query(
        `SELECT id_habilidad FROM habilidades WHERE habilidad = ? LIMIT 1`, [hab],
      );
      if (rows.length) {
        await this.dataSource.query(
          `INSERT INTO egresado_habilidades (id_egresado, id_habilidad) VALUES (?, ?)`,
          [id_egresado, rows[0].id_habilidad],
        );
      }
    }

    if (dto.habilidad_otro && dto.habilidad_otro.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO habilidades_otro (id_egresado, descripcion) VALUES (?, ?)`,
        [id_egresado, dto.habilidad_otro.trim()],
      );
    }

    for (const col of dto.colaboraciones) {
      const rows = await this.dataSource.query(
        `SELECT id_colaboracion FROM colaboraciones WHERE descripcion = ? LIMIT 1`, [col],
      );
      if (rows.length) {
        await this.dataSource.query(
          `INSERT INTO egresado_colaboraciones (id_egresado, id_colaboracion) VALUES (?, ?)`,
          [id_egresado, rows[0].id_colaboracion],
        );
      }
    }

    if (dto.colaboracion_otro && dto.colaboracion_otro.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO colaboracion_otro (id_egresado, descripcion) VALUES (?, ?)`,
        [id_egresado, dto.colaboracion_otro.trim()],
      );
    }

    return { mensaje: 'Etapa 2 completada. Registro finalizado.' };
  }


  // BUSCAR POR CORREO
  async buscarPorCorreo(correo: string): Promise<{ id_egresado: number } | null> {
    const rows = await this.dataSource.query(
      `SELECT id_egresado FROM egresados WHERE correo = ? LIMIT 1`, [correo],
    );
    return rows.length ? { id_egresado: rows[0].id_egresado } : null;
  }


  // FIND ALL
  async findAll(): Promise<Egresado[]> {
    return this.egresadosRepo.find();
  }

  async findAllConDetalles(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT
        e.id_egresado, e.nombre_completo, e.correo, e.telefono,
        e.ciudad_residencia, e.anio_egreso, e.empresa, e.ciudad_trabajo,
        e.fecha_registro, e.numero_control, e.linkedin, e.puesto_trabajo,
        e.estatus_titulacion, e.satisfaccion_formacion,
        g.genero, c.nombre_carrera,
        ni.nivel     AS nivel_ingles,
        ae.rango     AS antiguedad_empleo,
        cl.nivel     AS coincidencia_laboral,
        sl.situacion AS situacion_laboral,
        cv.respuesta AS certificacion_vigente,
        aut.autorizo_estadisticas,
        aut.autorizo_contacto,
        aut.autorizo_eventos
      FROM egresados e
      LEFT JOIN generos                  g   ON e.genero_id                  = g.id_genero
      LEFT JOIN carreras                 c   ON e.carrera_id                 = c.id_carrera
      LEFT JOIN niveles_ingles           ni  ON e.nivel_ingles_id            = ni.id_nivel
      LEFT JOIN antiguedad_empleo        ae  ON e.antiguedad_empleo_id       = ae.id_antiguedad
      LEFT JOIN coincidencia_laboral     cl  ON e.coincidencia_laboral_id    = cl.id_coincidencia
      LEFT JOIN situacion_laboral        sl  ON e.situacion_laboral_id       = sl.id_situacion
      LEFT JOIN certificaciones_vigentes cv  ON e.certificacion_vigente_id   = cv.id_certificacion_vigente
      LEFT JOIN autorizaciones           aut ON e.id_egresado                = aut.id_egresado
      ORDER BY e.fecha_registro DESC
    `);
  }


  // REMOVE
  async remove(id: number): Promise<{ mensaje: string }> {

    const existe = await this.egresadosRepo.findOne({ where: { id_egresado: id } });
    if (!existe) {
      throw new NotFoundException(`No se encontró el egresado con id ${id}.`);
    }

    await this.dataSource.query(`DELETE FROM autorizaciones          WHERE id_egresado = ?`, [id]);
    await this.dataSource.query(`DELETE FROM certificaciones         WHERE id_egresado = ?`, [id]);
    await this.dataSource.query(`DELETE FROM egresado_habilidades    WHERE id_egresado = ?`, [id]);
    await this.dataSource.query(`DELETE FROM habilidades_otro        WHERE id_egresado = ?`, [id]);
    await this.dataSource.query(`DELETE FROM egresado_colaboraciones WHERE id_egresado = ?`, [id]);
    await this.dataSource.query(`DELETE FROM colaboracion_otro       WHERE id_egresado = ?`, [id]);
    await this.egresadosRepo.delete(id);

    return { mensaje: 'Egresado eliminado correctamente.' };
  }


  // GET PERFIL
  async getPerfil(id: number): Promise<any> {
    const rows = await this.dataSource.query(`
      SELECT
        e.id_egresado, e.nombre_completo, e.correo, e.telefono,
        e.ciudad_residencia, e.anio_egreso, e.empresa, e.ciudad_trabajo,
        e.fecha_registro, e.numero_control, e.linkedin, e.puesto_trabajo,
        e.estatus_titulacion, e.satisfaccion_formacion,
        g.genero, c.nombre_carrera,
        ni.nivel        AS nivel_ingles,
        ae.rango        AS antiguedad_empleo,
        cl.nivel        AS coincidencia_laboral,
        sl.situacion    AS situacion_laboral,
        cv.respuesta    AS certificacion_vigente,
        aut.autorizo_estadisticas,
        aut.autorizo_contacto,
        aut.autorizo_eventos
      FROM egresados e
      LEFT JOIN generos                  g   ON e.genero_id                = g.id_genero
      LEFT JOIN carreras                 c   ON e.carrera_id               = c.id_carrera
      LEFT JOIN niveles_ingles           ni  ON e.nivel_ingles_id          = ni.id_nivel
      LEFT JOIN antiguedad_empleo        ae  ON e.antiguedad_empleo_id     = ae.id_antiguedad
      LEFT JOIN coincidencia_laboral     cl  ON e.coincidencia_laboral_id  = cl.id_coincidencia
      LEFT JOIN situacion_laboral        sl  ON e.situacion_laboral_id     = sl.id_situacion
      LEFT JOIN certificaciones_vigentes cv  ON e.certificacion_vigente_id = cv.id_certificacion_vigente
      LEFT JOIN autorizaciones           aut ON e.id_egresado              = aut.id_egresado
      WHERE e.id_egresado = ?
    `, [id]);

    if (!rows.length) throw new NotFoundException(`Egresado ${id} no encontrado.`);
    const egresado = rows[0];

    const certificaciones = await this.dataSource.query(
      `SELECT nombre_certificacion FROM certificaciones WHERE id_egresado = ?`, [id],
    );
    const habilidades = await this.dataSource.query(`
      SELECT h.habilidad FROM egresado_habilidades eh
      JOIN habilidades h ON eh.id_habilidad = h.id_habilidad
      WHERE eh.id_egresado = ?
    `, [id]);
    const habilidadesOtro = await this.dataSource.query(
      `SELECT descripcion FROM habilidades_otro WHERE id_egresado = ?`, [id],
    );
    const colaboraciones = await this.dataSource.query(`
      SELECT c.descripcion FROM egresado_colaboraciones ec
      JOIN colaboraciones c ON ec.id_colaboracion = c.id_colaboracion
      WHERE ec.id_egresado = ?
    `, [id]);
    const colaboracionesOtro = await this.dataSource.query(
      `SELECT descripcion FROM colaboracion_otro WHERE id_egresado = ?`, [id],
    );

    return {
      ...egresado,
      certificaciones: certificaciones.map((r: any) => r.nombre_certificacion),
      habilidades: habilidades.map((r: any) => r.habilidad),
      habilidades_otro: habilidadesOtro.map((r: any) => r.descripcion),
      colaboraciones: colaboraciones.map((r: any) => r.descripcion),
      colaboraciones_otro: colaboracionesOtro.map((r: any) => r.descripcion),
    };
  }


  // ESTADÍSTICAS
  async getEstadisticas(carrera?: string, anio?: number): Promise<any> {

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (carrera) {
      conditions.push(`c.nombre_carrera = ?`);
      params.push(carrera);
    }
    if (anio) {
      conditions.push(`e.anio_egreso = ?`);
      params.push(anio);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // 1. KPIs
    const [kpis] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                              AS total_egresados,
        SUM(aut.autorizo_contacto)                            AS autorizo_contacto,
        SUM(aut.autorizo_eventos)                             AS autorizo_eventos,
        ROUND(AVG(e.satisfaccion_formacion), 2)               AS satisfaccion_promedio,
        SUM(e.estatus_titulacion = 'Titulado')                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')             AS no_titulados,
        SUM(sl.situacion != 'Desempleado')                    AS empleados,
        SUM(sl.situacion  = 'Desempleado')                    AS desempleados
      FROM egresados e
      LEFT JOIN autorizaciones    aut ON e.id_egresado           = aut.id_egresado
      LEFT JOIN situacion_laboral sl  ON e.situacion_laboral_id  = sl.id_situacion
      LEFT JOIN carreras          c   ON e.carrera_id            = c.id_carrera
      ${where}
    `, params);

    // 2. Situación laboral
    const situacionLaboral = await this.dataSource.query(`
      SELECT sl.situacion, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY sl.situacion ORDER BY total DESC
    `, params);

    // 3. Empleabilidad por carrera
    const empleabilidadCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera, COUNT(*) AS total,
             SUM(sl.situacion != 'Desempleado') AS empleados
      FROM egresados e
      LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      ${where}
      GROUP BY c.nombre_carrera ORDER BY empleados DESC
    `, params);

    // 4. Titulación por año
    const titulacionAnio = await this.dataSource.query(`
      SELECT e.anio_egreso, COUNT(*) AS total,
             SUM(e.estatus_titulacion = 'Titulado')   AS titulados,
             SUM(e.estatus_titulacion = 'En trámite') AS en_tramite,
             ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1) AS pct_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso ORDER BY e.anio_egreso ASC
    `, params);

    // 5. Niveles de inglés
    const nivelesIngles = await this.dataSource.query(`
      SELECT ni.nivel, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY ni.nivel ORDER BY total DESC
    `, params);

    // 6. Inglés por carrera
    const inglesCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera, ni.nivel, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY c.nombre_carrera, ni.nivel ORDER BY c.nombre_carrera, total DESC
    `, params);

    // 7. Satisfacción por carrera
    const satisfaccionCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera, ROUND(AVG(e.satisfaccion_formacion), 2) AS promedio
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY c.nombre_carrera ORDER BY promedio DESC
    `, params);

    // 8. Top empresas
    const topEmpresas = await this.dataSource.query(`
      SELECT e.empresa, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.empresa IS NOT NULL AND e.empresa != ''
      GROUP BY e.empresa ORDER BY total DESC LIMIT 10
    `, params);

    // 9. Evolución por generación
    const evolucionGeneracion = await this.dataSource.query(`
      SELECT e.anio_egreso, COUNT(*) AS total,
             ROUND(SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1) AS pct_empleados,
             ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1) AS pct_titulados,
             ROUND(AVG(e.satisfaccion_formacion) * 20, 1) AS satisfaccion_pct
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso ORDER BY e.anio_egreso ASC
    `, params);

    // 10. Sector laboral
    const sectorLaboral = await this.dataSource.query(`
      SELECT sl.situacion AS sector, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY sl.situacion ORDER BY total DESC
    `, params);

    // 11. Participación por carrera
    const participacionCarrera = await this.dataSource.query(`
      SELECT c.nombre_carrera,
             SUM(aut.autorizo_contacto) AS autorizo_contacto,
             SUM(aut.autorizo_eventos)  AS autorizo_eventos,
             COUNT(*) AS total
      FROM egresados e
      LEFT JOIN autorizaciones aut ON e.id_egresado = aut.id_egresado
      LEFT JOIN carreras c         ON e.carrera_id  = c.id_carrera
      ${where}
      GROUP BY c.nombre_carrera ORDER BY total DESC
    `, params);

    // 12. Fuera de México
    const fueraMexico = await this.dataSource.query(`
      SELECT e.ciudad_trabajo, c.nombre_carrera, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND e.ciudad_trabajo NOT LIKE '%México%'
      AND e.ciudad_trabajo NOT LIKE '%Mexico%'
      GROUP BY e.ciudad_trabajo, c.nombre_carrera
      ORDER BY total DESC
    `, params);

    // 13. Fuera de Durango (en México, sin Durango)
    const fueraDurango = await this.dataSource.query(`
      SELECT e.ciudad_trabajo, c.nombre_carrera, COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND (e.ciudad_trabajo LIKE '%México%' OR e.ciudad_trabajo LIKE '%Mexico%')
      AND e.ciudad_trabajo NOT LIKE 'Durango%'
      GROUP BY e.ciudad_trabajo, c.nombre_carrera
      ORDER BY total DESC
    `, params);

    // 14. Coincidencia laboral por carrera
    const coincidenciaCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        cl.nivel AS coincidencia,
        COUNT(*) AS total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1) AS porcentaje
      FROM egresados e
      LEFT JOIN carreras             c  ON e.carrera_id             = c.id_carrera
      LEFT JOIN coincidencia_laboral cl ON e.coincidencia_laboral_id = cl.id_coincidencia
      ${where}
      GROUP BY c.nombre_carrera, cl.nivel
      ORDER BY c.nombre_carrera, total DESC
    `, params);

    // 15. Tiempo estimado para emplearse por carrera
    const tiempoEmpleoCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*) AS total_egresados,
        ROUND(AVG(
          GREATEST(
            YEAR(NOW()) - CASE ae.rango
              WHEN 'Menos de 1 año'  THEN 0.5
              WHEN 'De 1 a 3 años'   THEN 2
              WHEN 'Más de 3 años'   THEN 4
              ELSE 0
            END - e.anio_egreso,
            0
          )
        ), 1) AS anios_promedio_para_emplearse
      FROM egresados e
      LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
      LEFT JOIN antiguedad_empleo ae ON e.antiguedad_empleo_id = ae.id_antiguedad
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      ${where}
      AND sl.situacion != 'Desempleado'
      GROUP BY c.nombre_carrera
      ORDER BY anios_promedio_para_emplearse ASC
    `, params);

    // 16. Tiempo estimado global para emplearse (KPI)
    const [tiempoEmpleoGeneral] = await this.dataSource.query(`
      SELECT
        ROUND(AVG(
          GREATEST(
            YEAR(NOW()) - CASE ae.rango
              WHEN 'Menos de 1 año'  THEN 0.5
              WHEN 'De 1 a 3 años'   THEN 2
              WHEN 'Más de 3 años'   THEN 4
              ELSE 0
            END - e.anio_egreso,
            0
          )
        ), 1) AS anios_promedio_general
      FROM egresados e
      LEFT JOIN antiguedad_empleo ae ON e.antiguedad_empleo_id = ae.id_antiguedad
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras          c  ON e.carrera_id           = c.id_carrera
      ${where}
      AND sl.situacion != 'Desempleado'
    `, params);

    // TITULACIÓN

    // 17. Titulación por carrera
    const titulacionCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*)                                                               AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')                              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')                             AS no_titulados,
        ROUND(SUM(e.estatus_titulacion = 'Titulado')    * 100.0 / COUNT(*), 1) AS pct_titulados,
        ROUND(SUM(e.estatus_titulacion = 'En trámite')  * 100.0 / COUNT(*), 1) AS pct_en_tramite,
        ROUND(SUM(e.estatus_titulacion = 'No titulado') * 100.0 / COUNT(*), 1) AS pct_no_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera
      ORDER BY pct_titulados DESC
    `, params);

    // 18. Egresados con posgrado
    const posgradoParams: any[] = [];
    const posgradoConditions: string[] = ['e.carrera_id IN (15, 16)'];
    if (anio) {
      posgradoConditions.push(`e.anio_egreso = ?`);
      posgradoParams.push(anio);
    }
    const posgradoWhere = `WHERE ${posgradoConditions.join(' AND ')}`;

    const posgradoPorTipo = await this.dataSource.query(`
      SELECT
        c.nombre_carrera AS tipo_posgrado,
        COUNT(*)         AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${posgradoWhere}
      GROUP BY c.nombre_carrera
      ORDER BY total DESC
    `, posgradoParams);

    const [totalPosgrado] = await this.dataSource.query(`
      SELECT COUNT(*) AS total
      FROM egresados e
      ${posgradoWhere}
    `, posgradoParams);

    // 19. Titulación por carrera y año
    const titulacionCarreraAnio = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        e.anio_egreso,
        COUNT(*)                                                               AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')                              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')                             AS no_titulados,
        ROUND(SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1)   AS pct_titulados
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, e.anio_egreso
      ORDER BY c.nombre_carrera ASC, e.anio_egreso ASC
    `, params);

    return {
      kpis,
      situacionLaboral,
      empleabilidadCarrera,
      titulacionAnio,
      nivelesIngles,
      inglesCarrera,
      satisfaccionCarrera,
      topEmpresas,
      evolucionGeneracion,
      sectorLaboral,
      participacionCarrera,
      fueraMexico,
      fueraDurango,
      coincidenciaCarrera,
      tiempoEmpleoCarrera,
      tiempoEmpleoGeneral,
      titulacionCarrera,
      posgradoPorTipo,
      totalPosgrado,
      titulacionCarreraAnio,
    };
  }

  // DISTRIBUCIÓN GEOGRÁFICA
  async getDistribucionGeografica(carrera?: string, anio?: number): Promise<any> {

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (carrera) {
      conditions.push(`c.nombre_carrera = ?`);
      params.push(carrera);
    }
    if (anio) {
      conditions.push(`e.anio_egreso = ?`);
      params.push(anio);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // 1. KPIs geográficos
    const [kpisGeo] = await this.dataSource.query(`
      SELECT
        COUNT(*)                                                              AS total_mapeados,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
        )                                                                     AS con_ciudad_trabajo,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        )                                                                     AS en_extranjero,
        COUNT(DISTINCT
          CASE
            WHEN e.ciudad_trabajo IS NOT NULL
              AND e.ciudad_trabajo != ''
              AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
            THEN TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1))
          END
        )                                                                     AS paises_distintos,
        COUNT(DISTINCT
          CASE
            WHEN e.ciudad_trabajo IS NOT NULL AND e.ciudad_trabajo != ''
            THEN e.ciudad_trabajo
          END
        )                                                                     AS ciudades_trabajo_distintas
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
    `, params);

    // 2. Top ciudades de trabajo (todas, incluyendo Durango)
    const topCiudadesTrabajo = await this.dataSource.query(`
      SELECT
        e.ciudad_trabajo,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      GROUP BY e.ciudad_trabajo
      ORDER BY total DESC
      LIMIT 10
    `, params);

    // 3. Egresados en el extranjero agrupados por país
    const extranjerosPorPais = await this.dataSource.query(`
      SELECT
        TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) AS pais,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
      GROUP BY pais
      ORDER BY total DESC
    `, params);

    // 4. Egresados en el extranjero con ciudad detallada
    const extranjerosDetalle = await this.dataSource.query(`
      SELECT
        e.ciudad_trabajo,
        TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1))  AS pais,
        COUNT(*) AS total
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
      GROUP BY e.ciudad_trabajo
      ORDER BY total DESC
    `, params);

    // 5. Movilidad por año de egreso
    const movilidadPorAnio = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        COUNT(*)                                                AS total,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
        )                                                       AS fuera_durango,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        )                                                       AS en_extranjero,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND e.ciudad_trabajo NOT LIKE 'Durango%'
          ) * 100.0 / COUNT(*), 1
        )                                                       AS pct_fuera_durango,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
          ) * 100.0 / COUNT(*), 1
        )                                                       AS pct_extranjero
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso
      ORDER BY e.anio_egreso ASC
    `, params);

    // 6. Movilidad por carrera
    const movilidadPorCarrera = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        COUNT(*)                                                AS total,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
        )                                                       AS fuera_durango,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND e.ciudad_trabajo NOT LIKE 'Durango%'
          ) * 100.0 / COUNT(*), 1
        )                                                       AS pct_fuera_durango
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera
      ORDER BY pct_fuera_durango DESC
    `, params);

    return {
      kpisGeo,
      topCiudadesTrabajo,
      extranjerosPorPais,
      extranjerosDetalle,
      movilidadPorAnio,
      movilidadPorCarrera,
    };
  }

  // VINCULACIÓN: egresados por colaboración
  async getEgresadosPorColaboracion(colaboracion: string, carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [colaboracion];
    const conditions: string[] = [`col.descripcion = ?`];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
           c.nombre_carrera, g.genero
    FROM egresado_colaboraciones ec
    JOIN colaboraciones col ON ec.id_colaboracion = col.id_colaboracion
    JOIN egresados e        ON ec.id_egresado     = e.id_egresado
    LEFT JOIN carreras c    ON e.carrera_id        = c.id_carrera
    LEFT JOIN generos g     ON e.genero_id         = g.id_genero
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: egresados por habilidad a reforzar
  async getEgresadosPorHabilidad(habilidad: string, carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [habilidad];
    const conditions: string[] = [`h.habilidad = ?`];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
           c.nombre_carrera, g.genero
    FROM egresado_habilidades eh
    JOIN habilidades h      ON eh.id_habilidad = h.id_habilidad
    JOIN egresados e        ON eh.id_egresado  = e.id_egresado
    LEFT JOIN carreras c    ON e.carrera_id    = c.id_carrera
    LEFT JOIN generos g     ON e.genero_id     = g.id_genero
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: egresados por tipo de autorización
  async getEgresadosPorAutorizacion(
    tipo: 'estadisticas' | 'contacto' | 'eventos',
    carrera?: string,
    anio?: number,
  ): Promise<any[]> {
    const columna = {
      estadisticas: 'aut.autorizo_estadisticas',
      contacto: 'aut.autorizo_contacto',
      eventos: 'aut.autorizo_eventos',
    }[tipo];

    const params: any[] = [];
    const conditions: string[] = [`${columna} = 1`];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return this.dataSource.query(`
    SELECT
      e.id_egresado,
      e.nombre_completo,
      e.correo,
      e.telefono,
      c.nombre_carrera,
      g.genero
    FROM autorizaciones aut
    JOIN egresados  e ON aut.id_egresado = e.id_egresado
    LEFT JOIN carreras c ON e.carrera_id  = c.id_carrera
    LEFT JOIN generos  g ON e.genero_id   = g.id_genero
    ${where}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: totales por colaboración (incluye "Otro")
  async getTotalesColaboraciones(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const joins: string[] = [
      'LEFT JOIN egresados e        ON ec.id_egresado     = e.id_egresado',
      'LEFT JOIN carreras  c        ON e.carrera_id       = c.id_carrera',
    ];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const fijas = await this.dataSource.query(`
    SELECT
      col.descripcion,
      COUNT(ec.id_egresado) AS total
    FROM colaboraciones col
    LEFT JOIN egresado_colaboraciones ec ON col.id_colaboracion = ec.id_colaboracion
    ${joins.join('\n')}
    ${where}
    GROUP BY col.id_colaboracion, col.descripcion
    ORDER BY total DESC
  `, params);

    const otroParams: any[] = [];
    const otroJoins = [
      'LEFT JOIN egresados e ON co.id_egresado = e.id_egresado',
      'LEFT JOIN carreras  c ON e.carrera_id   = c.id_carrera',
    ];
    const otroConditions: string[] = [];
    if (carrera) { otroConditions.push(`c.nombre_carrera = ?`); otroParams.push(carrera); }
    if (anio) { otroConditions.push(`e.anio_egreso = ?`); otroParams.push(anio); }
    const otroWhere = otroConditions.length ? `WHERE ${otroConditions.join(' AND ')}` : '';

    const [otro] = await this.dataSource.query(`
    SELECT COUNT(*) AS total
    FROM colaboracion_otro co
    ${otroJoins.join('\n')}
    ${otroWhere}
  `, otroParams);

    return [
      ...fijas,
      { descripcion: '__otro__', total: +otro.total || 0 },
    ];
  }

  // VINCULACIÓN: totales por habilidad (incluye "Otro")
  async getTotalesHabilidades(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const joins: string[] = [
      'LEFT JOIN egresados e ON eh.id_egresado  = e.id_egresado',
      'LEFT JOIN carreras  c ON e.carrera_id    = c.id_carrera',
    ];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const fijas = await this.dataSource.query(`
    SELECT
      h.habilidad,
      COUNT(eh.id_egresado) AS total
    FROM habilidades h
    LEFT JOIN egresado_habilidades eh ON h.id_habilidad = eh.id_habilidad
    ${joins.join('\n')}
    ${where}
    GROUP BY h.id_habilidad, h.habilidad
    ORDER BY total DESC
  `, params);

    const otroParams: any[] = [];
    const otroJoins = [
      'LEFT JOIN egresados e ON ho.id_egresado = e.id_egresado',
      'LEFT JOIN carreras  c ON e.carrera_id   = c.id_carrera',
    ];
    const otroConditions: string[] = [];
    if (carrera) { otroConditions.push(`c.nombre_carrera = ?`); otroParams.push(carrera); }
    if (anio) { otroConditions.push(`e.anio_egreso = ?`); otroParams.push(anio); }
    const otroWhere = otroConditions.length ? `WHERE ${otroConditions.join(' AND ')}` : '';

    const [otro] = await this.dataSource.query(`
    SELECT COUNT(*) AS total
    FROM habilidades_otro ho
    ${otroJoins.join('\n')}
    ${otroWhere}
  `, otroParams);

    return [
      ...fijas,
      { habilidad: '__otro__', total: +otro.total || 0 },
    ];
  }

  // VINCULACIÓN: egresados con colaboración "Otro"
  async getEgresadosColaboracionOtro(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
           c.nombre_carrera, g.genero, co.descripcion AS descripcion_otro
    FROM colaboracion_otro co
    JOIN egresados e     ON co.id_egresado = e.id_egresado
    LEFT JOIN carreras c ON e.carrera_id   = c.id_carrera
    LEFT JOIN generos g  ON e.genero_id    = g.id_genero
    ${where}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: egresados con habilidad "Otro"
  async getEgresadosHabilidadOtro(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = [];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.dataSource.query(`
    SELECT e.id_egresado, e.nombre_completo, e.correo, e.telefono,
           c.nombre_carrera, g.genero, ho.descripcion AS descripcion_otro
    FROM habilidades_otro ho
    JOIN egresados e     ON ho.id_egresado = e.id_egresado
    LEFT JOIN carreras c ON e.carrera_id   = c.id_carrera
    LEFT JOIN generos g  ON e.genero_id    = g.id_genero
    ${where}
    ORDER BY e.nombre_completo ASC
  `, params);
  }

  // VINCULACIÓN: distribución real de satisfacción (conteo por nivel 1-5)
  async getDistribucionSatisfaccion(carrera?: string, anio?: number): Promise<any[]> {
    const params: any[] = [];
    const conditions: string[] = ['satisfaccion_formacion IS NOT NULL'];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = `WHERE ${conditions.join(' AND ')}`;
    const join = (carrera || anio)
      ? `LEFT JOIN carreras c ON e.carrera_id = c.id_carrera`
      : '';

    return this.dataSource.query(`
    SELECT
      e.satisfaccion_formacion AS nivel,
      COUNT(*)                 AS total
    FROM egresados e
    ${join}
    ${where}
    GROUP BY e.satisfaccion_formacion
    ORDER BY e.satisfaccion_formacion ASC
  `, params);
  }

  // ── NORMALIZACIÓN DE GÉNERO ───────────────────────────────────────────────
  // La BD guarda 'masculino' / 'femenino'. Este CASE los normaliza a
  // 'Hombre' / 'Mujer' en todas las queries para que el frontend
  // no necesite conocer los valores internos de la BD.
  private readonly generoCase = `
    CASE g.genero
      WHEN 'masculino'       THEN 'Hombre'
      WHEN 'femenino'        THEN 'Mujer'
      WHEN 'prefiero no decir' THEN 'Prefiero no decir'
      ELSE g.genero
    END
  `;

  // ── ESTADÍSTICAS DE GÉNERO ────────────────────────────────────────────────
  async getEstadisticasGenero(carrera?: string, anio?: number): Promise<any> {

    const params: any[] = [];
    const conditions: string[] = ['1=1'];

    if (carrera) { conditions.push(`c.nombre_carrera = ?`); params.push(carrera); }
    if (anio) { conditions.push(`e.anio_egreso = ?`); params.push(anio); }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // ── 1. KPIs principales por género ────────────────────────────────────
    const kpisGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1)                   AS porcentaje
      FROM egresados e
      LEFT JOIN generos g  ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero
      ORDER BY total DESC
    `, params);

    // ── 2. Proporción H/M por carrera (para KPIs de carrera más femenina/masculina) ──
    const proporcionCarreraGenero = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, g.genero
      ORDER BY c.nombre_carrera, g.genero
    `, params);

    // ── 3. Egreso por año × género ────────────────────────────────────────
    const egresoAnioGenero = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY e.anio_egreso), 1
        )                                                                     AS porcentaje_en_anio
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY e.anio_egreso, g.genero
      ORDER BY e.anio_egreso ASC, g.genero
    `, params);

    // ── 4. Composición H/M por carrera (barras 100% apiladas) ────────────
    const composicionCarreraGenero = await this.dataSource.query(`
      SELECT
        c.nombre_carrera,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY c.nombre_carrera), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY c.nombre_carrera, g.genero
      ORDER BY c.nombre_carrera, g.genero
    `, params);

    // ── 5. Tasa de empleo por género ──────────────────────────────────────
    const empleabilidadGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(sl.situacion != 'Desempleado')                                    AS empleados,
        SUM(sl.situacion  = 'Desempleado')                                    AS desempleados,
        ROUND(
          SUM(sl.situacion != 'Desempleado') * 100.0 / COUNT(*), 1
        )                                                                     AS pct_empleados,
        ROUND(AVG(e.satisfaccion_formacion), 2)                               AS satisfaccion_promedio
      FROM egresados e
      LEFT JOIN generos          g  ON e.genero_id           = g.id_genero
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras         c  ON e.carrera_id          = c.id_carrera
      ${where}
      GROUP BY g.genero
    `, params);

    // ── 6. Sector laboral por género ──────────────────────────────────────
    const sectorLaboralGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        sl.situacion                                                          AS sector,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos          g  ON e.genero_id           = g.id_genero
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras         c  ON e.carrera_id          = c.id_carrera
      ${where}
      GROUP BY g.genero, sl.situacion
      ORDER BY g.genero, total DESC
    `, params);

    // ── 7. Coincidencia laboral por género ────────────────────────────────
    const coincidenciaLaboralGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        cl.nivel                                                              AS coincidencia,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos             g  ON e.genero_id             = g.id_genero
      LEFT JOIN coincidencia_laboral cl ON e.coincidencia_laboral_id = cl.id_coincidencia
      LEFT JOIN carreras            c  ON e.carrera_id            = c.id_carrera
      ${where}
      GROUP BY g.genero, cl.nivel
      ORDER BY g.genero, total DESC
    `, params);

    // ── 8. Tiempo promedio en conseguir empleo por género ─────────────────
    const tiempoEmpleoGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        ROUND(AVG(
          CASE ae.rango
            WHEN 'Menos de 1 año' THEN 0.5
            WHEN 'De 1 a 3 años'  THEN 2
            WHEN 'Más de 3 años'  THEN 4
            ELSE 0
          END
        ), 1)                                                                 AS tiempo_promedio_anios
      FROM egresados e
      LEFT JOIN generos          g  ON e.genero_id            = g.id_genero
      LEFT JOIN antiguedad_empleo ae ON e.antiguedad_empleo_id = ae.id_antiguedad
      LEFT JOIN situacion_laboral sl ON e.situacion_laboral_id = sl.id_situacion
      LEFT JOIN carreras         c  ON e.carrera_id           = c.id_carrera
      ${where}
      AND sl.situacion != 'Desempleado'
      GROUP BY g.genero
    `, params);

    // ── 9. Distribución geográfica por género ─────────────────────────────
    const geografiaGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(
          e.ciudad_trabajo LIKE 'Durango%'
          OR e.ciudad_trabajo IS NULL
          OR e.ciudad_trabajo = ''
        )                                                                     AS en_durango,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND e.ciudad_trabajo NOT LIKE 'Durango%'
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) = 'México'
        )                                                                     AS fuera_durango_mexico,
        SUM(
          e.ciudad_trabajo IS NOT NULL
          AND e.ciudad_trabajo != ''
          AND TRIM(SUBSTRING_INDEX(e.ciudad_trabajo, ',', -1)) != 'México'
        )                                                                     AS en_extranjero,
        ROUND(
          SUM(
            e.ciudad_trabajo IS NOT NULL
            AND e.ciudad_trabajo != ''
            AND e.ciudad_trabajo NOT LIKE 'Durango%'
          ) * 100.0 / COUNT(*), 1
        )                                                                     AS pct_fuera_durango
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero
    `, params);

    // ── 10. Top ciudades de trabajo por género ────────────────────────────
    const topCiudadesGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        e.ciudad_trabajo,
        COUNT(*)                                                              AS total
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.ciudad_trabajo IS NOT NULL
      AND e.ciudad_trabajo != ''
      GROUP BY g.genero, e.ciudad_trabajo
      ORDER BY g.genero, total DESC
    `, params);

    // ── 11. Titulación global por género ──────────────────────────────────
    const titulacionGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        SUM(e.estatus_titulacion = 'En trámite')                              AS en_tramite,
        SUM(e.estatus_titulacion = 'No titulado')                             AS no_titulados,
        ROUND(SUM(e.estatus_titulacion = 'Titulado')   * 100.0 / COUNT(*), 1) AS pct_titulados,
        ROUND(SUM(e.estatus_titulacion = 'En trámite') * 100.0 / COUNT(*), 1) AS pct_en_tramite,
        ROUND(SUM(e.estatus_titulacion = 'No titulado')* 100.0 / COUNT(*), 1) AS pct_no_titulados
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY g.genero
    `, params);

    // ── 12. Titulación por año × género ───────────────────────────────────
    const titulacionAnioGenero = await this.dataSource.query(`
      SELECT
        e.anio_egreso,
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total,
        SUM(e.estatus_titulacion = 'Titulado')                                AS titulados,
        ROUND(
          SUM(e.estatus_titulacion = 'Titulado') * 100.0 / COUNT(*), 1
        )                                                                     AS pct_titulados
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      AND e.carrera_id NOT IN (15, 16)
      GROUP BY e.anio_egreso, g.genero
      ORDER BY e.anio_egreso ASC, g.genero
    `, params);

    // ── 13. Posgrado por género ───────────────────────────────────────────
    // No aplica filtro de carrera porque el posgrado IS carrera_id IN (15,16)
    const posgradoParams: any[] = [];
    const posgradoConditions: string[] = ['e.carrera_id IN (15, 16)'];
    if (anio) { posgradoConditions.push(`e.anio_egreso = ?`); posgradoParams.push(anio); }
    const posgradoWhere = `WHERE ${posgradoConditions.join(' AND ')}`;

    const posgradoGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        COUNT(*)                                                              AS total
      FROM egresados e
      LEFT JOIN generos g ON e.genero_id = g.id_genero
      ${posgradoWhere}
      GROUP BY g.genero
    `, posgradoParams);

    // ── 14. Posgrado por tipo y género ────────────────────────────────────
    const posgradoTipoGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        c.nombre_carrera                                                      AS tipo_posgrado,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${posgradoWhere}
      GROUP BY g.genero, c.nombre_carrera
      ORDER BY g.genero, total DESC
    `, posgradoParams);

    // ── 15. Nivel de inglés por género ────────────────────────────────────
    const inglesGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        ni.nivel,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresados e
      LEFT JOIN generos        g  ON e.genero_id       = g.id_genero
      LEFT JOIN niveles_ingles ni ON e.nivel_ingles_id = ni.id_nivel
      LEFT JOIN carreras       c  ON e.carrera_id      = c.id_carrera
      ${where}
      GROUP BY g.genero, ni.nivel
      ORDER BY g.genero, total DESC
    `, params);

    // ── 16. Satisfacción académica por género ─────────────────────────────
    const satisfaccionGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        ROUND(AVG(e.satisfaccion_formacion), 2)                               AS promedio,
        COUNT(*)                                                              AS total,
        SUM(e.satisfaccion_formacion = 5)                                     AS muy_satisfecho,
        SUM(e.satisfaccion_formacion = 4)                                     AS satisfecho,
        SUM(e.satisfaccion_formacion = 3)                                     AS neutral,
        SUM(e.satisfaccion_formacion = 2)                                     AS insatisfecho,
        SUM(e.satisfaccion_formacion = 1)                                     AS muy_insatisfecho
      FROM egresados e
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero
    `, params);

    // ── 17. Habilidades que faltaron por género ───────────────────────────
    const habilidadesGenero = await this.dataSource.query(`
      SELECT
        ${this.generoCase}                                                    AS genero,
        h.habilidad,
        COUNT(*)                                                              AS total,
        ROUND(
          COUNT(*) * 100.0
          / SUM(COUNT(*)) OVER (PARTITION BY g.genero), 1
        )                                                                     AS porcentaje
      FROM egresado_habilidades eh
      JOIN egresados   e ON eh.id_egresado  = e.id_egresado
      JOIN habilidades h ON eh.id_habilidad = h.id_habilidad
      LEFT JOIN generos  g ON e.genero_id  = g.id_genero
      LEFT JOIN carreras c ON e.carrera_id = c.id_carrera
      ${where}
      GROUP BY g.genero, h.habilidad
      ORDER BY g.genero, total DESC
    `, params);

    return {
      kpisGenero,
      proporcionCarreraGenero,
      egresoAnioGenero,
      composicionCarreraGenero,
      empleabilidadGenero,
      sectorLaboralGenero,
      coincidenciaLaboralGenero,
      tiempoEmpleoGenero,
      geografiaGenero,
      topCiudadesGenero,
      titulacionGenero,
      titulacionAnioGenero,
      posgradoGenero,
      posgradoTipoGenero,
      inglesGenero,
      satisfaccionGenero,
      habilidadesGenero,
    };
  }
}