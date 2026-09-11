import { Controller, Get, UseGuards } from '@nestjs/common';
import { ColabOtroService } from './colabOtro.service';
import { ColabOtro } from './colabOtro.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('colaboracion-otro')
export class ColabOtroController {

  constructor(private readonly colabOtroService: ColabOtroService) {}

  @Get()
  findAll(): Promise<ColabOtro[]> {
    return this.colabOtroService.findAll();
  }
}