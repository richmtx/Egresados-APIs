import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notificacion } from './notificaciones.entity';
import { CreateNotificacionDto } from './dto/create-notificacion.dto';

@Injectable()
export class NotificacionesService {

  constructor(
    @InjectRepository(Notificacion)
    private notificacionesRepo: Repository<Notificacion>,
  ) { }

  async crear(dto: CreateNotificacionDto): Promise<Notificacion> {
    const notificacion = this.notificacionesRepo.create({
      tipo: dto.tipo,
      titulo: dto.titulo,
      descripcion: dto.descripcion,
      id_egresado: dto.id_egresado ?? null,
      leida: false,
    });
    return this.notificacionesRepo.save(notificacion);
  }

  async findAll(): Promise<Notificacion[]> {
    return this.notificacionesRepo.find({
      order: { fecha_creacion: 'DESC' },
    });
  }

  async findNoLeidas(): Promise<Notificacion[]> {
    return this.notificacionesRepo.find({
      where: { leida: false },
      order: { fecha_creacion: 'DESC' },
    });
  }

  async countNoLeidas(): Promise<{ total: number }> {
    const total = await this.notificacionesRepo.count({ where: { leida: false } });
    return { total };
  }

  async marcarLeida(id: number): Promise<{ mensaje: string }> {
    await this.notificacionesRepo.update(id, { leida: true });
    return { mensaje: 'Notificación marcada como leída.' };
  }

  async marcarTodasLeidas(): Promise<{ mensaje: string }> {
    await this.notificacionesRepo
      .createQueryBuilder()
      .update(Notificacion)
      .set({ leida: true })
      .where('leida = :leida', { leida: false })
      .execute();
    return { mensaje: 'Todas las notificaciones marcadas como leídas.' };
  }

  async findByTipo(tipo: string): Promise<Notificacion[]> {
    return this.notificacionesRepo.find({
      where: { tipo },
      order: { fecha_creacion: 'DESC' },
    });
  }

  async remove(id: number): Promise<{ mensaje: string }> {
    await this.notificacionesRepo.delete(id);
    return { mensaje: 'Notificación eliminada.' };
  }

  // Eliminar todas las notificaciones
  async removeAll(): Promise<{ mensaje: string; eliminadas: number }> {
    const result = await this.notificacionesRepo
      .createQueryBuilder()
      .delete()
      .from(Notificacion)
      .execute();
    return {
      mensaje: 'Todas las notificaciones han sido eliminadas.',
      eliminadas: result.affected ?? 0,
    };
  }

  // Eliminar solo las notificaciones leídas
  async removeLeidas(): Promise<{ mensaje: string; eliminadas: number }> {
    const result = await this.notificacionesRepo
      .createQueryBuilder()
      .delete()
      .from(Notificacion)
      .where('leida = :leida', { leida: true })
      .execute();
    return {
      mensaje: 'Notificaciones leídas eliminadas.',
      eliminadas: result.affected ?? 0,
    };
  }

  // Limpieza automática (llamada por el Cron)
  async limpiezaAutomatica(): Promise<void> {
    const ahora = new Date();

    // Leídas con más de 30 días
    const corte30 = new Date(ahora);
    corte30.setDate(corte30.getDate() - 30);

    // No leídas con más de 90 días
    const corte90 = new Date(ahora);
    corte90.setDate(corte90.getDate() - 90);

    await this.notificacionesRepo
      .createQueryBuilder()
      .delete()
      .from(Notificacion)
      .where('leida = true AND fecha_creacion < :corte30', { corte30 })
      .orWhere('leida = false AND fecha_creacion < :corte90', { corte90 })
      .execute();
  }
}