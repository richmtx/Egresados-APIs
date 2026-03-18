import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Situacion } from './situacion.entity';
import { SituacionService } from './situacion.service';
import { SituacionController } from './situacion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Situacion])],
  controllers: [SituacionController],
  providers: [SituacionService],
})
export class SituacionModule {}