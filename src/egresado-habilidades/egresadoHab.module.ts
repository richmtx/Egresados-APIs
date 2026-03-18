import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EgresadoHab } from './egresadoHab.entity';
import { EgresadoHabService } from './egresadoHab.service';
import { EgresadoHabController } from './egresadoHab.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EgresadoHab])],
  controllers: [EgresadoHabController],
  providers: [EgresadoHabService],
})
export class EgresadoHabModule {}