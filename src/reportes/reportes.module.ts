import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';
import { ReporteHistorial } from './reportes.entity';
import { EgresadosModule } from '../egresados/egresados.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReporteHistorial]),
    EgresadosModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule { }