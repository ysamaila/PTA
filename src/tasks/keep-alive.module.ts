import { Module } from '@nestjs/common';
import { KeepAliveService } from './keep-alive.service.js';

@Module({
  providers: [KeepAliveService],
  exports: [KeepAliveService],
})
export class KeepAliveModule {}
