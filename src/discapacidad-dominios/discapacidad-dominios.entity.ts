import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('discapacidad_dominios')
export class DiscapacidadDominio {

  @PrimaryGeneratedColumn()
  id_dominio: number;

  @Column()
  clave: string;

  @Column()
  pregunta: string;

  @Column()
  orden: number;

  // Migración 015: 0 = ya no se pregunta (autocuidado). No se expone en el
  // catálogo público; solo se usa para filtrar.
  @Column({ type: 'tinyint' })
  activo: number;
}
