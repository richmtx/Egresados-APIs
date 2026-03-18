import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('titulacion')
export class Titulacion {

  @PrimaryGeneratedColumn()
  id_titulacion: number;

  @Column()
  estatus: string;
}