import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('colaboracion_otro')
export class ColabOtro {

  @PrimaryGeneratedColumn()
  id_otro: number;

  @Column()
  id_egresado: number;

  @Column()
  descripcion: string;
}