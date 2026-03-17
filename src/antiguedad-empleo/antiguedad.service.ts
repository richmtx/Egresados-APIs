import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Antiguedad } from './antiguedad.entity';

@Injectable()
export class AntiguedadService {

  constructor(
    @InjectRepository(Antiguedad)
    private antiguedadRepository: Repository<Antiguedad>,
  ) {}

  async findAll(): Promise<Antiguedad[]> {
    return this.antiguedadRepository.find();
  }
}