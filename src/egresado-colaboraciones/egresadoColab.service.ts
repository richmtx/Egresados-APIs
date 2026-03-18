import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EgresadoColab } from './egresadoColab.entity';

@Injectable()
export class EgresadoColabService {

  constructor(
    @InjectRepository(EgresadoColab)
    private egresadoColabRepository: Repository<EgresadoColab>,
  ) {}

  findAll(): Promise<EgresadoColab[]> {
    return this.egresadoColabRepository.find();
  }
}