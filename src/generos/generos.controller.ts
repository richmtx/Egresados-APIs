import { Controller, Get } from '@nestjs/common';
import { GenerosService } from './generos.service';
import { Genero } from './generos.entity';

@Controller('generos')
export class GenerosController {

  constructor(private readonly generosService: GenerosService) {}

  @Get()
  findAll(): Promise<Genero[]> {
    return this.generosService.findAll();
  }
}