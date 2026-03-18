import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Habilidad } from './habilidades.entity';

@Injectable()
export class HabilidadesService {

  constructor(
    @InjectRepository(Habilidad)
    private habilidadRepository: Repository<Habilidad>,
  ) {}

  findAll(): Promise<Habilidad[]> {
    return this.habilidadRepository.find();
  }
}