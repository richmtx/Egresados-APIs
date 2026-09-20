import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RespuestaAutoadscripcion } from './respuestas-autoadscripcion.entity';

@Injectable()
export class RespuestasAutoadscripcionService {

  constructor(
    @InjectRepository(RespuestaAutoadscripcion)
    private respuestasAutoadscripcionRepository: Repository<RespuestaAutoadscripcion>,
  ) {}

  async findAll(): Promise<RespuestaAutoadscripcion[]> {
    return this.respuestasAutoadscripcionRepository.find({ order: { orden: 'ASC' } });
  }
}
