import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('generos')
export class Genero {

  @PrimaryGeneratedColumn()
  id_genero: number;

  @Column()
  genero: string;
}