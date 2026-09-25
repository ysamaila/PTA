import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import type { AppDetails } from './app.service.js';

@ApiTags('Root')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Get application metadata and system status' })
  @ApiResponse({
    status: 200,
    description: 'Application metadata and system status',
  })
  getAppDetails(): AppDetails {
    return this.appService.getAppDetails();
  }
}

