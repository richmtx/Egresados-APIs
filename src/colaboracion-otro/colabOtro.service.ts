import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ColabOtro } from './colabOtro.entity';

@Injectable()
export class ColabOtroService {

  constructor(
    @InjectRepository(ColabOtro)
    private colabOtroRepository: Repository<ColabOtro>,
  ) {}

  findAll(): Promise<ColabOtro[]> {
    return this.colabOtroRepository.find();
  }
}