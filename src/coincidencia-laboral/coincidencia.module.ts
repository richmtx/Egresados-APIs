import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coincidencia } from './coincidencia.entity';
import { CoincidenciaService } from './coincidencia.service';
import { CoincidenciaController } from './coincidencia.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Coincidencia])],
  controllers: [CoincidenciaController],
  providers: [CoincidenciaService],
})
export class CoincidenciaModule {}