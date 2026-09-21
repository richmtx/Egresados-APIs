import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstadoEstudio } from './estados-estudio.entity';
import { EstadosEstudioService } from './estados-estudio.service';
import { EstadosEstudioController } from './estados-estudio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EstadoEstudio])],
  controllers: [EstadosEstudioController],
  providers: [EstadosEstudioService],
})
export class EstadosEstudioModule {}
