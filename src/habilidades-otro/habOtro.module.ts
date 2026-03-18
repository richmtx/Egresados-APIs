import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HabOtro } from './habOtro.entity';
import { HabOtroService } from './habOtro.service';
import { HabOtroController } from './habOtro.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HabOtro])],
  controllers: [HabOtroController],
  providers: [HabOtroService],
})
export class HabOtroModule {}