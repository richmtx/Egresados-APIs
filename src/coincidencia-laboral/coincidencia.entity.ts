import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('coincidencia_laboral')
export class Coincidencia {

  @PrimaryGeneratedColumn()
  id_coincidencia: number;

  @Column()
  nivel: string;
}