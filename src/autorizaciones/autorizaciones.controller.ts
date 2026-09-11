import { Controller, Get, UseGuards } from '@nestjs/common';
import { AutorizacionesService } from './autorizaciones.service';
import { Autorizacion } from './autorizaciones.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('autorizaciones')
export class AutorizacionesController {

  constructor(private readonly autorizacionesService: AutorizacionesService) {}

  @Get()
  findAll(): Promise<Autorizacion[]> {
    return this.autorizacionesService.findAll();
  }
}