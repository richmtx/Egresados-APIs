import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('certificaciones_vigentes')
export class CertificacionVigente {

  @PrimaryGeneratedColumn()
  id_certificacion_vigente: number;

  @Column()
  respuesta: string;
}