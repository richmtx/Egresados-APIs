import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Formacion } from './formacion.entity';

@Injectable()
export class FormacionService {

  constructor(
    @InjectRepository(Formacion)
    private formacionRepository: Repository<Formacion>,
  ) {}

  findAll(): Promise<Formacion[]> {
    return this.formacionRepository.find();
  }
}