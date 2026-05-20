import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('reportes_historial')
export class ReporteHistorial {

  @PrimaryGeneratedColumn()
  id_reporte: number;

  @Column({ type: 'varchar', length: 50 })
  tipo_reporte: string;

  @Column({ type: 'varchar', length: 20 })
  organismo: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  carrera: string | null;

  @Column({ type: 'int', nullable: true })
  anio: number | null;

  @Column({ type: 'varchar', length: 10, default: 'PDF' })
  formato: string;

  @Column({ type: 'varchar', length: 100, default: 'Sistema' })
  generado_por: string;

  @CreateDateColumn()
  fecha_generacion: Date;
}