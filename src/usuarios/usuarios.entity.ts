import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('usuarios')
export class Usuario {

  @PrimaryGeneratedColumn()
  id_usuario: number;

  @Column()
  usuario: string;

  @Column({ name: 'nombre_completo' })
  nombre_completo: string;

  @Column()
  contrasena: string;

  @Column({ type: 'enum', enum: ['admin', 'invitado'], default: 'invitado' })
  rol: 'admin' | 'invitado';

  @Column({ type: 'enum', enum: ['activo', 'inactivo'], default: 'activo' })
  estado: 'activo' | 'inactivo';

  @Column({ type: 'datetime', nullable: true })
  ultimo_acceso: Date | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  fecha_creacion: Date;
}