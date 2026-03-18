import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HabOtro } from './habOtro.entity';

@Injectable()
export class HabOtroService {

  constructor(
    @InjectRepository(HabOtro)
    private habOtroRepository: Repository<HabOtro>,
  ) {}

  findAll(): Promise<HabOtro[]> {
    return this.habOtroRepository.find();
  }
}