import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('egresados')
export class Egresado {

  @PrimaryGeneratedColumn()
  id_egresado: number;

  @Column({ type: 'varchar', length: 150 })
  nombre_completo: string;

  @Column({ type: 'varchar', length: 20 })
  numero_control: string;

  @Column({ type: 'varchar', length: 120 })
  correo: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'year' })
  anio_egreso: number;

  @Column()
  carrera_id: number;

  @Column()
  genero_id: number;

  @Column()
  nivel_ingles_id: number;

  @Column({ type: 'varchar', length: 120 })
  ciudad_residencia: string;

  @Column({ type: 'varchar', length: 120 })
  ciudad_trabajo: string;

  @Column({ type: 'varchar', length: 120 })
  situacion_laboral: string;

  @Column({ type: 'varchar', length: 150 })
  empresa: string;

  @Column({ type: 'varchar', length: 150 })
  puesto_trabajo: string;

  @Column()
  coincidencia_laboral_id: number;

  @Column()
  antiguedad_empleo_id: number;

  @Column()
  satisfaccion_formacion: number;

  @Column({ type: 'tinyint' })
  certificacion_posgrado: number;

  @Column({ type: 'varchar', length: 100 })
  estatus_titulacion: string;

  @Column({ type: 'varchar', length: 255 })
  linkedin: string;

  @Column({ type: 'timestamp' })
  fecha_registro: Date;
}