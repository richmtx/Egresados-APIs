import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Coincidencia } from './coincidencia.entity';

@Injectable()
export class CoincidenciaService {

  constructor(
    @InjectRepository(Coincidencia)
    private coincidenciaRepository: Repository<Coincidencia>,
  ) {}

  async findAll(): Promise<Coincidencia[]> {
    return this.coincidenciaRepository.find();
  }
}