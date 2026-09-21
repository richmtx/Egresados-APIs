import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RangoEmpleados } from './rangos-empleados.entity';
import { RangosEmpleadosService } from './rangos-empleados.service';
import { RangosEmpleadosController } from './rangos-empleados.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RangoEmpleados])],
  controllers: [RangosEmpleadosController],
  providers: [RangosEmpleadosService],
})
export class RangosEmpleadosModule {}
