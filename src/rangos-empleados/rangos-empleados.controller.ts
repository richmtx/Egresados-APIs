import { Controller, Get } from '@nestjs/common';
import { RangosEmpleadosService } from './rangos-empleados.service';
import { RangoEmpleados } from './rangos-empleados.entity';

@Controller('rangos-empleados')
export class RangosEmpleadosController {

  constructor(private readonly rangosEmpleadosService: RangosEmpleadosService) {}

  @Get()
  findAll(): Promise<RangoEmpleados[]> {
    return this.rangosEmpleadosService.findAll();
  }
}
