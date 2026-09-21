import { Controller, Get } from '@nestjs/common';
import { NivelesEstudioService } from './niveles-estudio.service';
import { NivelEstudio } from './niveles-estudio.entity';

@Controller('niveles-estudio')
export class NivelesEstudioController {

  constructor(private readonly nivelesEstudioService: NivelesEstudioService) {}

  @Get()
  findAll(): Promise<NivelEstudio[]> {
    return this.nivelesEstudioService.findAll();
  }
}
