import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GradoDificultad } from './grados-dificultad.entity';

@Injectable()
export class GradosDificultadService {

  constructor(
    @InjectRepository(GradoDificultad)
    private gradosDificultadRepository: Repository<GradoDificultad>,
  ) {}

  // Catálogo PÚBLICO: no se expone cuenta_discapacidad (regla de clasificación
  // del instrumento); solo la usa internamente el módulo de inclusión.
  async findAll(): Promise<GradoDificultad[]> {
    return this.gradosDificultadRepository.find({
      select: { id_grado: true, clave: true, descripcion: true, orden: true },
      order: { orden: 'ASC' },
    });
  }
}
