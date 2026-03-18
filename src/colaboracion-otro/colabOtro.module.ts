import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ColabOtro } from './colabOtro.entity';
import { ColabOtroService } from './colabOtro.service';
import { ColabOtroController } from './colabOtro.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ColabOtro])],
  controllers: [ColabOtroController],
  providers: [ColabOtroService],
})
export class ColabOtroModule {}