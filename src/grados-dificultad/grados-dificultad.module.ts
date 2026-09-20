import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GradoDificultad } from './grados-dificultad.entity';
import { GradosDificultadService } from './grados-dificultad.service';
import { GradosDificultadController } from './grados-dificultad.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GradoDificultad])],
  controllers: [GradosDificultadController],
  providers: [GradosDificultadService],
})
export class GradosDificultadModule {}
