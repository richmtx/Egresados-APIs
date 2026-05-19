import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { NotificacionesModule } from '../notificaciones/notificaciones.module';

@Module({
    imports: [NotificacionesModule],
    controllers: [DashboardController],
    providers: [DashboardService],
})
export class DashboardModule { }