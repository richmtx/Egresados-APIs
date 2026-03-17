import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Carrera } from './carreras.entity';

@Injectable()
export class CarrerasService {

  constructor(
    @InjectRepository(Carrera)
    private carrerasRepository: Repository<Carrera>,
  ) {}

  // Obtener todas las carreras
  async findAll(): Promise<Carrera[]> {
    return this.carrerasRepository.find();
  }
}