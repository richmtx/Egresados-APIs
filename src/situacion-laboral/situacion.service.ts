import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Situacion } from './situacion.entity';

@Injectable()
export class SituacionService {

  constructor(
    @InjectRepository(Situacion)
    private situacionRepository: Repository<Situacion>,
  ) {}

  findAll(): Promise<Situacion[]> {
    return this.situacionRepository.find();
  }
}