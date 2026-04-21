import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Egresado } from './egresados.entity';
import { EgresadosService } from './egresados.service';
import { EgresadosController } from './egresados.controller';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Egresado]),
    NotificacionesModule,
  ],
  controllers: [EgresadosController],
  providers: [EgresadosService],
  exports: [EgresadosService],
})
export class EgresadosModule {}