import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('antiguedad_empleo')
export class Antiguedad {

  @PrimaryGeneratedColumn()
  id_antiguedad: number;

  @Column()
  rango: string;
}