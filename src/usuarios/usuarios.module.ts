import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario } from './usuarios.entity';
import { HistorialActividad } from './historial-actividad.entity';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario, HistorialActividad]), AuthModule],
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
})
export class UsuariosModule { }