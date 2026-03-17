import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Certificacion } from './certificaciones.entity';

@Injectable()
export class CertificacionesService {

  constructor(
    @InjectRepository(Certificacion)
    private certificacionesRepository: Repository<Certificacion>,
  ) {}

  async findAll(): Promise<Certificacion[]> {
    return this.certificacionesRepository.find();
  }
}