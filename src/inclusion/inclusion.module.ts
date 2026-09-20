import { Module } from '@nestjs/common';
import { InclusionController } from './inclusion.controller';
import { InclusionService } from './inclusion.service';

@Module({
  controllers: [InclusionController],
  providers: [InclusionService],
})
export class InclusionModule { }
