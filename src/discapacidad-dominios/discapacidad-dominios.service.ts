import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscapacidadDominio } from './discapacidad-dominios.entity';

@Injectable()
export class DiscapacidadDominiosService {

  constructor(
    @InjectRepository(DiscapacidadDominio)
    private discapacidadDominiosRepository: Repository<DiscapacidadDominio>,
  ) {}

  // Catálogo PÚBLICO que pinta la pregunta de discapacidad del formulario:
  // solo los dominios activos (migración 015 apagó autocuidado). Se filtra por
  // la columna, no por clave, para que un dominio reactivado vuelva a salir solo.
  async findAll(): Promise<DiscapacidadDominio[]> {
    return this.discapacidadDominiosRepository.find({
      select: { id_dominio: true, clave: true, pregunta: true, orden: true },
      where: { activo: 1 },
      order: { orden: 'ASC' },
    });
  }
}
