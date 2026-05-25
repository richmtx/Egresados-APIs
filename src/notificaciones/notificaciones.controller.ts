import { Controller, Get, Patch, Delete, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificacionesService } from './notificaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@UseGuards(JwtAuthGuard, RolesGuard)
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

  @Delete('todas')
  removeAll() {
    return this.notificacionesService.removeAll();
  }

  @Delete('leidas')
  removeLeidas() {
    return this.notificacionesService.removeLeidas();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notificacionesService.remove(id);
  }

  // Cada domingo a las 2:00 AM
  @Cron('0 2 * * 0')
  handleLimpiezaAutomatica() {
    return this.notificacionesService.limpiezaAutomatica();
  }
}
