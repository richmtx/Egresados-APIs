import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('respuestas_autoadscripcion')
export class RespuestaAutoadscripcion {

  @PrimaryGeneratedColumn()
  id_respuesta: number;

  @Column()
  clave: string;

  @Column()
  descripcion: string;

  @Column()
  orden: number;
}
