import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Autorizacion } from './autorizaciones.entity';
import { AutorizacionesService } from './autorizaciones.service';
import { AutorizacionesController } from './autorizaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Autorizacion])],
  controllers: [AutorizacionesController],
  providers: [AutorizacionesService],
})
export class AutorizacionesModule {}