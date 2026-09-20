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

  async findAll(): Promise<DiscapacidadDominio[]> {
    return this.discapacidadDominiosRepository.find({ order: { orden: 'ASC' } });
  }
}
