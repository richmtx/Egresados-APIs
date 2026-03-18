import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Habilidad } from './habilidades.entity';
import { HabilidadesService } from './habilidades.service';
import { HabilidadesController } from './habilidades.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Habilidad])],
  controllers: [HabilidadesController],
  providers: [HabilidadesService],
})
export class HabilidadesModule {}