import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('situacion_laboral')
export class Situacion {

  @PrimaryGeneratedColumn()
  id_situacion: number;

  @Column()
  situacion: string;
}