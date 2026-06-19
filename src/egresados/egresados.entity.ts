import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('egresados')
@Index('uq_egresados_correo', ['correo'], { unique: true })
export class Egresado {

  @PrimaryGeneratedColumn()
  id_egresado: number;

  @Column({ type: 'varchar', length: 150 })
  nombre_completo: string;

  @Column()
  genero_id: number;

  @Column({ type: 'varchar', length: 120 })
  correo: string;

  @Column({ type: 'varchar', length: 20 })
  telefono: string;

  @Column({ type: 'varchar', length: 120 })
  ciudad_residencia: string;

  @Column()
  carrera_id: number;

  @Column({ type: 'year' })
  anio_egreso: number;

  @Column()
  nivel_ingles_id: number;

  @Column({ type: 'varchar', length: 150 })
  empresa: string;

  @Column()
  antiguedad_empleo_id: number;

  // ── NUEVO: primer empleo ──────────────────────────────────────────────
  @Column({ type: 'int', nullable: true })
  tiempo_primer_empleo_id: number | null;

  @Column({ type: 'int', nullable: true })
  medio_primer_empleo_id: number | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  medio_primer_empleo_otro: string | null;
  // ──────────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 120 })
  ciudad_trabajo: string;

  @Column({ type: 'timestamp' })
  fecha_registro: Date;

  @Column({ type: 'varchar', length: 20 })
  numero_control: string;

  @Column({ type: 'varchar', length: 255 })
  linkedin: string;

  // ── NUEVO: redes sociales (opcionales) ────────────────────────────────
  @Column({ type: 'varchar', length: 255, nullable: true })
  facebook: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  instagram: string | null;
  // ──────────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 150 })
  puesto_trabajo: string;

  @Column()
  coincidencia_laboral_id: number;

  @Column({ type: 'varchar', length: 100 })
  estatus_titulacion: string;

  @Column()
  situacion_laboral_id: number;

  @Column()
  satisfaccion_formacion: number;

  @Column()
  certificacion_vigente_id: number;

  @Column({ type: 'tinyint', default: 0 })
  revisado: boolean;

  @Column({ type: 'datetime', nullable: true })
  fecha_revision: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  revisado_por: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  foto_url: string | null;

  @Column({ type: 'tinyint', default: 0 })
  registro_completo: boolean;
}