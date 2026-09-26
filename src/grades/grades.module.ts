import { Module } from '@nestjs/common';
import { GradesService } from './grades.service.js';
import { GradesController } from './grades.controller.js';
import { PrismaModule } from '../database/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [GradesController],
  providers: [GradesService],
  exports: [GradesService],
})
export class GradesModule {}
