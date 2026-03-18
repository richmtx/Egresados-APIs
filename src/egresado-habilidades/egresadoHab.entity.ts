import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('egresado_habilidades')
export class EgresadoHab {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_egresado: number;

  @Column()
  id_habilidad: number;
}