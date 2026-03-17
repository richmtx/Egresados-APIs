import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificacionVigente } from './certificacionesV.entity';
import { CertificacionesVService } from './certificacionesV.service';
import { CertificacionesVController } from './certificacionesV.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CertificacionVigente])],
  controllers: [CertificacionesVController],
  providers: [CertificacionesVService],
})
export class CertificacionesVModule {}