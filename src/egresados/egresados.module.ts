import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Egresado } from './egresados.entity';
import { EgresadosController } from './egresados.controller';
import { EgresadosService } from './egresados.service';
import { ExportService } from './export/export.service';
import { ExportEstadisticasService } from './export/export-estadisticas.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Egresado]),
    NotificacionesModule,
  ],
  controllers: [EgresadosController],
  providers: [EgresadosService, ExportService, ExportEstadisticasService],
  exports: [EgresadosService],
})
export class EgresadosModule {}