import { Controller, Get, Patch, Delete, Param, ParseIntPipe, Query } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';

@Controller('notificaciones')
export class NotificacionesController {

  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get()
  findAll(@Query('tipo') tipo?: string) {
    if (tipo) return this.notificacionesService.findByTipo(tipo);
    return this.notificacionesService.findAll();
  }

  @Get('no-leidas')
  findNoLeidas() {
    return this.notificacionesService.findNoLeidas();
  }

  @Get('count')
  countNoLeidas() {
    return this.notificacionesService.countNoLeidas();
  }

  @Patch('marcar-todas')
  marcarTodasLeidas() {
    return this.notificacionesService.marcarTodasLeidas();
  }

  @Patch(':id/leer')
  marcarLeida(@Param('id', ParseIntPipe) id: number) {
    return this.notificacionesService.marcarLeida(id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notificacionesService.remove(id);
  }
}