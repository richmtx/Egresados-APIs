import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Usuario } from './usuarios.entity';

@Entity('historial_actividad')
export class HistorialActividad {

    @PrimaryGeneratedColumn()
    id_historial: number;

    @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'id_usuario' })
    usuario: Usuario;

    @Column({ type: 'varchar' })
    accion: string;

    @Column({ type: 'text', nullable: true })
    descripcion: string | null;

    @Column({ type: 'varchar', nullable: true })
    seccion: string | null;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    fecha_accion: Date;
}