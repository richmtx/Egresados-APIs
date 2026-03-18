import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('habilidades_otro')
export class HabOtro {

  @PrimaryGeneratedColumn()
  id_otro: number;

  @Column()
  id_egresado: number;

  @Column()
  descripcion: string;
}