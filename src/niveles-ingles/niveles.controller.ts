import { Controller, Get } from '@nestjs/common';
import { NivelesService } from './niveles.service';
import { Nivel } from './niveles.entity';

@Controller('niveles-ingles')
export class NivelesController {

  constructor(private readonly nivelesService: NivelesService) {}

  @Get()
  findAll(): Promise<Nivel[]> {
    return this.nivelesService.findAll();
  }
}