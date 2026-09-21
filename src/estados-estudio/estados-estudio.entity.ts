import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('estados_estudio')
export class EstadoEstudio {

  @PrimaryGeneratedColumn()
  id_estado_estudio: number;

  @Column()
  clave: string;

  @Column()
  descripcion: string;

  @Column()
  orden: number;
}
