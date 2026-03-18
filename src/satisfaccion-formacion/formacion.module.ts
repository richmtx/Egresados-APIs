import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Formacion } from './formacion.entity';
import { FormacionService } from './formacion.service';
import { FormacionController } from './formacion.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Formacion])],
  controllers: [FormacionController],
  providers: [FormacionService],
})
export class FormacionModule {}