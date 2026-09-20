import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DiscapacidadDominio } from './discapacidad-dominios.entity';
import { DiscapacidadDominiosService } from './discapacidad-dominios.service';
import { DiscapacidadDominiosController } from './discapacidad-dominios.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DiscapacidadDominio])],
  controllers: [DiscapacidadDominiosController],
  providers: [DiscapacidadDominiosService],
})
export class DiscapacidadDominiosModule {}
