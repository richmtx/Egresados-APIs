import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('colaboraciones')
export class Colaboracion {

  @PrimaryGeneratedColumn()
  id_colaboracion: number;

  @Column()
  descripcion: string;
}