import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Carrera } from './carreras.entity';
import { CarrerasService } from './carreras.service';
import { CarrerasController } from './carreras.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Carrera])],
  controllers: [CarrerasController],
  providers: [CarrerasService],
})
export class CarrerasModule {}