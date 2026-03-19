import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuarios')
export class Usuario {

  @PrimaryGeneratedColumn()
  id_usuario: number;

  @Column()
  usuario: string;

  @Column()
  contrasena: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;
}