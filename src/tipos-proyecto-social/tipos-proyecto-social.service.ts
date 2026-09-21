import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TipoProyectoSocial } from './tipos-proyecto-social.entity';

@Injectable()
export class TiposProyectoSocialService {

  constructor(
    @InjectRepository(TipoProyectoSocial)
    private tiposProyectoSocialRepository: Repository<TipoProyectoSocial>,
  ) {}

  async findAll(): Promise<TipoProyectoSocial[]> {
    return this.tiposProyectoSocialRepository.find({ order: { orden: 'ASC' } });
  }
}
