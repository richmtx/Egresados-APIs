import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NivelEstudio } from './niveles-estudio.entity';

@Injectable()
export class NivelesEstudioService {

  constructor(
    @InjectRepository(NivelEstudio)
    private nivelesEstudioRepository: Repository<NivelEstudio>,
  ) {}

  async findAll(): Promise<NivelEstudio[]> {
    return this.nivelesEstudioRepository.find({ order: { orden: 'ASC' } });
  }
}
