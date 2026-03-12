import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Egresado } from './egresados.entity';

@Injectable()
export class EgresadosService {

  constructor(
    @InjectRepository(Egresado)
    private egresadosRepository: Repository<Egresado>,
  ) {}

  async findAll(): Promise<Egresado[]> {
    return this.egresadosRepository.find();
  }

}