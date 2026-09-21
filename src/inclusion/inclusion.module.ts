import { Module } from '@nestjs/common';
import { InclusionController } from './inclusion.controller';
import { InclusionService } from './inclusion.service';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [UsuariosModule],
  controllers: [InclusionController],
  providers: [InclusionService],
})
export class InclusionModule { }
