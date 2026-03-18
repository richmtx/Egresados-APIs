import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Colaboracion } from './colaboraciones.entity';

@Injectable()
export class ColaboracionesService {

  constructor(
    @InjectRepository(Colaboracion)
    private colaboracionRepository: Repository<Colaboracion>,
  ) {}

  findAll(): Promise<Colaboracion[]> {
    return this.colaboracionRepository.find();
  }
}