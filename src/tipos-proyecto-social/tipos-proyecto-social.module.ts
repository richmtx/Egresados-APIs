import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TipoProyectoSocial } from './tipos-proyecto-social.entity';
import { TiposProyectoSocialService } from './tipos-proyecto-social.service';
import { TiposProyectoSocialController } from './tipos-proyecto-social.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TipoProyectoSocial])],
  controllers: [TiposProyectoSocialController],
  providers: [TiposProyectoSocialService],
})
export class TiposProyectoSocialModule {}
