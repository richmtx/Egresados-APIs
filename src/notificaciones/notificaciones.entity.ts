import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notificaciones')
export class Notificacion {

  @PrimaryGeneratedColumn()
  id_notificacion: number;

  @Column({ length: 50 })
  tipo: string;

  @Column({ length: 150 })
  titulo: string;

  @Column({ length: 300 })
  descripcion: string;

  @Column({ default: false })
  leida: boolean;

  @CreateDateColumn({ name: 'fecha_creacion' })
  fecha_creacion: Date;

  @Column({ type: 'int', nullable: true, default: null }) 
  id_egresado: number | null;
}