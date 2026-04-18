import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

import { Egresado } from './egresados.entity';
import { CreateEgresadoEtapa1Dto } from './dto/create-egresado-etapa1.dto';
import { CreateEgresadoEtapa2Dto } from './dto/create-egresado-etapa2.dto';

@Injectable()
export class EgresadosService {

  constructor(
    @InjectRepository(Egresado)
    private egresadosRepo: Repository<Egresado>,
    private dataSource: DataSource,
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


  //  ETAPA 1
  async crearEtapa1(dto: CreateEgresadoEtapa1Dto): Promise<{ id_egresado: number; mensaje: string }> {

    // Resolver IDs de catálogos
    const genero_id = await this.resolveId('generos', 'id_genero', 'genero', dto.genero);
    const carrera_id = await this.resolveId('carreras', 'id_carrera', 'nombre_carrera', dto.carrera);
    const nivel_ingles_id = await this.resolveId('niveles_ingles', 'id_nivel', 'nivel', dto.nivel_ingles);
    const situacion_laboral_id = await this.resolveId('situacion_laboral', 'id_situacion', 'situacion', dto.situacion_laboral);
    const antiguedad_empleo_id = await this.resolveId('antiguedad_empleo', 'id_antiguedad', 'rango', dto.antiguedad_empleo);
    const certificacion_vigente_id = await this.resolveId('certificaciones_vigentes', 'id_certificacion_vigente', 'respuesta', dto.certificacion_vigente);

    // Insertar en tabla egresados (campos de etapa 1)
    const result = await this.dataSource.query(
      `INSERT INTO egresados
        (nombre_completo, genero_id, correo, telefono, ciudad_residencia,
         carrera_id, anio_egreso, estatus_titulacion, certificacion_vigente_id,
         nivel_ingles_id, situacion_laboral_id, empresa, antiguedad_empleo_id,
         ciudad_trabajo, satisfaccion_formacion, fecha_registro,
         -- campos de etapa 2 con valores vacíos por ahora
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

    // Insertar en autorizaciones
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

    return { id_egresado, mensaje: 'Etapa 1 guardada correctamente.' };
  }

  //  ETAPA 2
  async completarEtapa2(
    id_egresado: number,
    dto: CreateEgresadoEtapa2Dto,
  ): Promise<{ mensaje: string }> {

    // Verificar que el egresado existe
    const existe = await this.egresadosRepo.findOne({ where: { id_egresado } });
    if (!existe) {
      throw new NotFoundException(`No se encontró el egresado con id ${id_egresado}.`);
    }

    // Resolver coincidencia laboral
    const coincidencia_laboral_id = await this.resolveId(
      'coincidencia_laboral', 'id_coincidencia', 'nivel', dto.coincidencia_laboral,
    );

    // Actualizar campos de etapa 2 en egresados
    await this.dataSource.query(
      `UPDATE egresados
         SET numero_control       = ?,
             linkedin             = ?,
             puesto_trabajo       = ?,
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

    // Insertar certificación específica (si la proporcionó)
    if (dto.certificaciones && dto.certificaciones.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO certificaciones (id_egresado, nombre_certificacion) VALUES (?, ?)`,
        [id_egresado, dto.certificaciones.trim()],
      );
    }

    // Insertar habilidades seleccionadas (tabla pivote egresado_habilidades)
    for (const hab of dto.habilidades) {
      const rows = await this.dataSource.query(
        `SELECT id_habilidad FROM habilidades WHERE habilidad = ? LIMIT 1`,
        [hab],
      );
      if (rows.length) {
        await this.dataSource.query(
          `INSERT INTO egresado_habilidades (id_egresado, id_habilidad) VALUES (?, ?)`,
          [id_egresado, rows[0].id_habilidad],
        );
      }
    }

    // Insertar habilidad "Otro" si aplica
    if (dto.habilidad_otro && dto.habilidad_otro.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO habilidades_otro (id_egresado, descripcion) VALUES (?, ?)`,
        [id_egresado, dto.habilidad_otro.trim()],
      );
    }

    // Insertar colaboraciones seleccionadas (tabla pivote egresado_colaboraciones)
    for (const col of dto.colaboraciones) {
      const rows = await this.dataSource.query(
        `SELECT id_colaboracion FROM colaboraciones WHERE descripcion = ? LIMIT 1`,
        [col],
      );
      if (rows.length) {
        await this.dataSource.query(
          `INSERT INTO egresado_colaboraciones (id_egresado, id_colaboracion) VALUES (?, ?)`,
          [id_egresado, rows[0].id_colaboracion],
        );
      }
    }

    // Insertar colaboración "Otro" si aplica
    if (dto.colaboracion_otro && dto.colaboracion_otro.trim() !== '') {
      await this.dataSource.query(
        `INSERT INTO colaboracion_otro (id_egresado, descripcion) VALUES (?, ?)`,
        [id_egresado, dto.colaboracion_otro.trim()],
      );
    }

    return { mensaje: 'Etapa 2 completada. Registro finalizado.' };
  }

  async buscarPorCorreo(correo: string): Promise<{ id_egresado: number } | null> {
    const rows = await this.dataSource.query(
      `SELECT id_egresado FROM egresados WHERE correo = ? LIMIT 1`,
      [correo],
    );
    return rows.length ? { id_egresado: rows[0].id_egresado } : null;
  }

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
      LEFT JOIN generos                 g   ON e.genero_id                  = g.id_genero
      LEFT JOIN carreras                c   ON e.carrera_id                 = c.id_carrera
      LEFT JOIN niveles_ingles          ni  ON e.nivel_ingles_id            = ni.id_nivel
      LEFT JOIN antiguedad_empleo       ae  ON e.antiguedad_empleo_id       = ae.id_antiguedad
      LEFT JOIN coincidencia_laboral    cl  ON e.coincidencia_laboral_id    = cl.id_coincidencia
      LEFT JOIN situacion_laboral       sl  ON e.situacion_laboral_id       = sl.id_situacion
      LEFT JOIN certificaciones_vigentes cv ON e.certificacion_vigente_id   = cv.id_certificacion_vigente
      LEFT JOIN autorizaciones          aut ON e.id_egresado                = aut.id_egresado
      ORDER BY e.fecha_registro DESC
    `);
  }

  async remove(id: number): Promise<void> {
    await this.egresadosRepo.delete(id);
  }
}