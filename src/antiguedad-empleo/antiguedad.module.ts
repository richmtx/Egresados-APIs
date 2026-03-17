import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Antiguedad } from './antiguedad.entity';
import { AntiguedadService } from './antiguedad.service';
import { AntiguedadController } from './antiguedad.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Antiguedad])],
  controllers: [AntiguedadController],
  providers: [AntiguedadService],
})
export class AntiguedadModule {}