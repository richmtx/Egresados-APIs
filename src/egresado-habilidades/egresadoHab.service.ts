import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EgresadoHab } from './egresadoHab.entity';

@Injectable()
export class EgresadoHabService {

  constructor(
    @InjectRepository(EgresadoHab)
    private egresadoHabRepository: Repository<EgresadoHab>,
  ) {}

  findAll(): Promise<EgresadoHab[]> {
    return this.egresadoHabRepository.find();
  }
}