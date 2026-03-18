import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('niveles_ingles')
export class Nivel {

  @PrimaryGeneratedColumn()
  id_nivel: number;

  @Column()
  nivel: string;
}