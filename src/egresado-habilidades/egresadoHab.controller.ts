import { Controller, Get, UseGuards } from '@nestjs/common';
import { EgresadoHabService } from './egresadoHab.service';
import { EgresadoHab } from './egresadoHab.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('egresado-habilidades')
export class EgresadoHabController {

  constructor(private readonly egresadoHabService: EgresadoHabService) {}

  @Get()
  findAll(): Promise<EgresadoHab[]> {
    return this.egresadoHabService.findAll();
  }
}