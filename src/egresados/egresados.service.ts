import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Egresado } from './egresados.entity';

@Injectable()
export class EgresadosService {

  constructor(
    @InjectRepository(Egresado)
    private egresadosRepository: Repository<Egresado>,
    private dataSource: DataSource,
  ) {}

  async findAll(): Promise<Egresado[]> {
    return this.egresadosRepository.find();
  }

  async findAllConDetalles(): Promise<any[]> {
    return this.dataSource.query(`
      SELECT
        e.id_egresado,
        e.nombre_completo,
        e.correo,
        e.telefono,
        e.ciudad_residencia,
        e.anio_egreso,
        e.empresa,
        e.ciudad_trabajo,
        e.fecha_registro,
        e.numero_control,
        e.linkedin,
        e.puesto_trabajo,
        e.estatus_titulacion,
        e.satisfaccion_formacion,
        g.genero,
        c.nombre_carrera,
        ni.nivel        AS nivel_ingles,
        ae.rango        AS antiguedad_empleo,
        cl.nivel        AS coincidencia_laboral,
        sl.situacion    AS situacion_laboral,
        cv.respuesta    AS certificacion_vigente,
        aut.autorizo_estadisticas,
        aut.autorizo_contacto,
        aut.autorizo_eventos
      FROM egresados e
      LEFT JOIN generos               g   ON e.genero_id                 = g.id_genero
      LEFT JOIN carreras              c   ON e.carrera_id                = c.id_carrera
      LEFT JOIN niveles_ingles        ni  ON e.nivel_ingles_id           = ni.id_nivel
      LEFT JOIN antiguedad_empleo     ae  ON e.antiguedad_empleo_id      = ae.id_antiguedad
      LEFT JOIN coincidencia_laboral  cl  ON e.coincidencia_laboral_id   = cl.id_coincidencia
      LEFT JOIN situacion_laboral     sl  ON e.situacion_laboral_id      = sl.id_situacion
      LEFT JOIN certificaciones_vigentes cv ON e.certificacion_vigente_id = cv.id_certificacion_vigente
      LEFT JOIN autorizaciones        aut ON e.id_egresado               = aut.id_egresado
      ORDER BY e.fecha_registro DESC
    `);
  }

  async remove(id: number): Promise<void> {
    await this.egresadosRepository.delete(id);
  }

}