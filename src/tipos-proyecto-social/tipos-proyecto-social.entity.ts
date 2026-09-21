import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('tipos_proyecto_social')
export class TipoProyectoSocial {

  @PrimaryGeneratedColumn()
  id_tipo_proyecto: number;

  @Column()
  clave: string;

  @Column()
  descripcion: string;

  @Column()
  orden: number;
}
