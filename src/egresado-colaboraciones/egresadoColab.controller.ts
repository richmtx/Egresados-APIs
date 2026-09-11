import { Controller, Get, UseGuards } from '@nestjs/common';
import { EgresadoColabService } from './egresadoColab.service';
import { EgresadoColab } from './egresadoColab.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('egresado-colaboraciones')
export class EgresadoColabController {

  constructor(private readonly egresadoColabService: EgresadoColabService) {}

  @Get()
  findAll(): Promise<EgresadoColab[]> {
    return this.egresadoColabService.findAll();
  }
}