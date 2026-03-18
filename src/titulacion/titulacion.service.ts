import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Titulacion } from './titulacion.entity';

@Injectable()
export class TitulacionService {

  constructor(
    @InjectRepository(Titulacion)
    private titulacionRepository: Repository<Titulacion>,
  ) {}

  findAll(): Promise<Titulacion[]> {
    return this.titulacionRepository.find();
  }
}