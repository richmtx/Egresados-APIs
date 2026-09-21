import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('niveles_estudio')
export class NivelEstudio {

  @PrimaryGeneratedColumn()
  id_nivel_estudio: number;

  @Column()
  clave: string;

  @Column()
  descripcion: string;

  @Column()
  orden: number;
}
