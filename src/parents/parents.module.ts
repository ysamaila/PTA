import { Module } from '@nestjs/common';
import { ParentsService } from './parents.service.js';
import { ParentsController } from './parents.controller.js';
import { DatabaseModule } from '../database/database.module.js';

@Module({
  imports: [DatabaseModule],
  controllers: [ParentsController],
  providers: [ParentsService],
  exports: [ParentsService],
})
export class ParentsModule {}
