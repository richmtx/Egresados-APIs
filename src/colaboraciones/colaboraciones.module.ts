import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Colaboracion } from './colaboraciones.entity';
import { ColaboracionesService } from './colaboraciones.service';
import { ColaboracionesController } from './colaboraciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Colaboracion])],
  controllers: [ColaboracionesController],
  providers: [ColaboracionesService],
})
export class ColaboracionesModule {}