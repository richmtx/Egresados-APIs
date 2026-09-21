import { Controller, Get } from '@nestjs/common';
import { TiposProyectoSocialService } from './tipos-proyecto-social.service';
import { TipoProyectoSocial } from './tipos-proyecto-social.entity';

@Controller('tipos-proyecto-social')
export class TiposProyectoSocialController {

  constructor(private readonly tiposProyectoSocialService: TiposProyectoSocialService) {}

  @Get()
  findAll(): Promise<TipoProyectoSocial[]> {
    return this.tiposProyectoSocialService.findAll();
  }
}
