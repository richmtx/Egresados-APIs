import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('rangos_empleados')
export class RangoEmpleados {

  @PrimaryGeneratedColumn()
  id_rango_empleados: number;

  @Column()
  clave: string;

  @Column()
  descripcion: string;

  @Column()
  orden: number;
}
