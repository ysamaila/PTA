import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import type { AppDetails } from './app.service.js';

@ApiTags('Root & Database Management')
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

  @Post('api/database/clean')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete and wipe all records from database tables',
    description:
      'Truncates all application tables (users, teachers, students, assignments, messages, behavior records, etc.) with CASCADE.',
  })
  @ApiResponse({
    status: 200,
    description: 'Database wiped successfully',
  })
  async cleanDatabasePost() {
    return this.appService.cleanDatabase();
  }

  @Delete('api/database/clean')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete and wipe all records from database tables',
    description:
      'Truncates all application tables (users, teachers, students, assignments, messages, behavior records, etc.) with CASCADE.',
  })
  @ApiResponse({
    status: 200,
    description: 'Database wiped successfully',
  })
  async cleanDatabaseDelete() {
    return this.appService.cleanDatabase();
  }

  @Delete('api/database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete and wipe all records from database tables',
  })
  @ApiResponse({
    status: 200,
    description: 'Database wiped successfully',
  })
  async cleanDatabaseDirectDelete() {
    return this.appService.cleanDatabase();
  }

  @Post('api/admin/clean-database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin wipe all records from database tables',
  })
  @ApiResponse({
    status: 200,
    description: 'Database wiped successfully',
  })
  async cleanDatabaseAdminPost() {
    return this.appService.cleanDatabase();
  }

  @Delete('api/admin/clean-database')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin wipe all records from database tables',
  })
  @ApiResponse({
    status: 200,
    description: 'Database wiped successfully',
  })
  async cleanDatabaseAdminDelete() {
    return this.appService.cleanDatabase();
  }
}

