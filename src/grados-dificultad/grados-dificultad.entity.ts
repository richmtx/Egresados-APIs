import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('grados_dificultad')
export class GradoDificultad {

  @PrimaryGeneratedColumn()
  id_grado: number;

  @Column()
  clave: string;

  @Column()
  descripcion: string;

  @Column({ type: 'tinyint' })
  cuenta_discapacidad: number;

  @Column()
  orden: number;
}
