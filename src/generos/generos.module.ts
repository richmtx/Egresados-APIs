import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Genero } from './generos.entity';
import { GenerosService } from './generos.service';
import { GenerosController } from './generos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Genero])],
  controllers: [GenerosController],
  providers: [GenerosService],
})
export class GenerosModule {}