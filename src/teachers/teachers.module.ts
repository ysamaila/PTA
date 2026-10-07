import { Module } from '@nestjs/common';
import { TeachersService } from './teachers.service.js';
import { TeachersController } from './teachers.controller.js';
import { PrismaModule } from '../database/prisma.module.js';
import { UploadModule } from '../upload/upload.module.js';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [TeachersController],
  providers: [TeachersService],
  exports: [TeachersService],
})
export class TeachersModule {}
