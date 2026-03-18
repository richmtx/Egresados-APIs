import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EgresadoColab } from './egresadoColab.entity';
import { EgresadoColabService } from './egresadoColab.service';
import { EgresadoColabController } from './egresadoColab.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EgresadoColab])],
  controllers: [EgresadoColabController],
  providers: [EgresadoColabService],
})
export class EgresadoColabModule {}