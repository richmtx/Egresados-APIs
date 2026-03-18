import { Controller, Get } from '@nestjs/common';
import { FormacionService } from './formacion.service';
import { Formacion } from './formacion.entity';

@Controller('satisfaccion-formacion')
export class FormacionController {

  constructor(private readonly formacionService: FormacionService) {}

  @Get()
  findAll(): Promise<Formacion[]> {
    return this.formacionService.findAll();
  }
}