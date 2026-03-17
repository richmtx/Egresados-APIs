import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('certificaciones')
export class Certificacion {

  @PrimaryGeneratedColumn()
  id_certificacion: number;

  @Column()
  id_egresado: number;

  @Column()
  nombre_certificacion: string;
}