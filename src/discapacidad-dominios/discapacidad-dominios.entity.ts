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
}
