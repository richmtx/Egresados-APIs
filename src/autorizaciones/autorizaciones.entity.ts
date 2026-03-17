import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('autorizaciones')
export class Autorizacion {

  @PrimaryGeneratedColumn()
  id_autorizacion: number;

  @Column()
  id_egresado: number;

  @Column()
  autorizo_estadisticas: boolean;

  @Column()
  autorizo_contacto: boolean;

  @Column()
  autorizo_eventos: boolean;
}