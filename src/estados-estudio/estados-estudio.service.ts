import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EstadoEstudio } from './estados-estudio.entity';

@Injectable()
export class EstadosEstudioService {

  constructor(
    @InjectRepository(EstadoEstudio)
    private estadosEstudioRepository: Repository<EstadoEstudio>,
  ) {}

  async findAll(): Promise<EstadoEstudio[]> {
    return this.estadosEstudioRepository.find({ order: { orden: 'ASC' } });
  }
}
