import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Nivel } from './niveles.entity';

@Injectable()
export class NivelesService {

  constructor(
    @InjectRepository(Nivel)
    private nivelRepository: Repository<Nivel>,
  ) {}

  findAll(): Promise<Nivel[]> {
    return this.nivelRepository.find();
  }
}