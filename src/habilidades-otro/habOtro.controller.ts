import { Controller, Get, UseGuards } from '@nestjs/common';
import { HabOtroService } from './habOtro.service';
import { HabOtro } from './habOtro.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('habilidades-otro')
export class HabOtroController {

  constructor(private readonly habOtroService: HabOtroService) {}

  @Get()
  findAll(): Promise<HabOtro[]> {
    return this.habOtroService.findAll();
  }
}