import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('habilidades')
export class Habilidad {

  @PrimaryGeneratedColumn()
  id_habilidad: number;

  @Column()
  habilidad: string;
}