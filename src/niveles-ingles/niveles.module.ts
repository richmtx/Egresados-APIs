import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Nivel } from './niveles.entity';
import { NivelesService } from './niveles.service';
import { NivelesController } from './niveles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Nivel])],
  controllers: [NivelesController],
  providers: [NivelesService],
})
export class NivelesModule {}