import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('egresado_colaboraciones')
export class EgresadoColab {

  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  id_egresado: number;

  @Column()
  id_colaboracion: number;
}