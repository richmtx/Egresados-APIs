import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Certificacion } from './certificaciones.entity';
import { CertificacionesService } from './certificaciones.service';
import { CertificacionesController } from './certificaciones.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Certificacion])],
  controllers: [CertificacionesController],
  providers: [CertificacionesService],
})
export class CertificacionesModule {}