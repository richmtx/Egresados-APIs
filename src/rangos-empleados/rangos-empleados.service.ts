import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RangoEmpleados } from './rangos-empleados.entity';

@Injectable()
export class RangosEmpleadosService {

  constructor(
    @InjectRepository(RangoEmpleados)
    private rangosEmpleadosRepository: Repository<RangoEmpleados>,
  ) {}

  async findAll(): Promise<RangoEmpleados[]> {
    return this.rangosEmpleadosRepository.find({ order: { orden: 'ASC' } });
  }
}
