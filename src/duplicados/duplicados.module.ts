import { Module } from '@nestjs/common';
import { DuplicadosController } from './duplicados.controller';
import { DuplicadosService } from './duplicados.service';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [UsuariosModule],
  controllers: [DuplicadosController],
  providers: [DuplicadosService],
})
export class DuplicadosModule { }
