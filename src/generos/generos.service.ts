import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Genero } from './generos.entity';

@Injectable()
export class GenerosService {

  constructor(
    @InjectRepository(Genero)
    private generoRepository: Repository<Genero>,
  ) {}

  findAll(): Promise<Genero[]> {
    return this.generoRepository.find();
  }
}