import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Autorizacion } from './autorizaciones.entity';

@Injectable()
export class AutorizacionesService {

  constructor(
    @InjectRepository(Autorizacion)
    private autorizacionesRepository: Repository<Autorizacion>,
  ) {}

  async findAll(): Promise<Autorizacion[]> {
    return this.autorizacionesRepository.find();
  }
}