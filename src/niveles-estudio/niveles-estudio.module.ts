import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NivelEstudio } from './niveles-estudio.entity';
import { NivelesEstudioService } from './niveles-estudio.service';
import { NivelesEstudioController } from './niveles-estudio.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NivelEstudio])],
  controllers: [NivelesEstudioController],
  providers: [NivelesEstudioService],
})
export class NivelesEstudioModule {}
