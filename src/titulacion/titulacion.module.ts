import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Titulacion } from './titulacion.entity';
import { TitulacionService } from './titulacion.service';
import { TitulacionController } from './titulacion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Titulacion])],
  controllers: [TitulacionController],
  providers: [TitulacionService],
})
export class TitulacionModule {}