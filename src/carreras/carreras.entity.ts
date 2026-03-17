import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('carreras')
export class Carrera {

  @PrimaryGeneratedColumn()
  id_carrera: number;

  @Column()
  nombre_carrera: string;
}