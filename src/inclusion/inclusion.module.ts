import { Module } from '@nestjs/common';
import { InclusionController } from './inclusion.controller';
import { InclusionService } from './inclusion.service';
import { ExportInclusionService } from './export/export-inclusion.service';
import { UsuariosModule } from '../usuarios/usuarios.module';

@Module({
  imports: [UsuariosModule],
  controllers: [InclusionController],
  providers: [InclusionService, ExportInclusionService],
})
export class InclusionModule { }
