import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('satisfaccion_formacion')
export class Formacion {

  @PrimaryGeneratedColumn()
  id_satisfaccion: number;

  @Column()
  nivel: string;
}