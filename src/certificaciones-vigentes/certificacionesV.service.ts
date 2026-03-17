import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CertificacionVigente } from './certificacionesV.entity';

@Injectable()
export class CertificacionesVService {

  constructor(
    @InjectRepository(CertificacionVigente)
    private certificacionesVRepository: Repository<CertificacionVigente>,
  ) {}

  async findAll(): Promise<CertificacionVigente[]> {
    return this.certificacionesVRepository.find();
  }
}