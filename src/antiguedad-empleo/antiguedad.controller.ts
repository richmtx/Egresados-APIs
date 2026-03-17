import { Controller, Get } from '@nestjs/common';
import { AntiguedadService } from './antiguedad.service';
import { Antiguedad } from './antiguedad.entity';

@Controller('antiguedad')
export class AntiguedadController {

  constructor(private readonly antiguedadService: AntiguedadService) {}

  @Get()
  findAll(): Promise<Antiguedad[]> {
    return this.antiguedadService.findAll();
  }
}