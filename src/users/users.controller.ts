import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateUserPreferencesDto } from './dto/update-preferences.dto.js';

@ApiTags('User Preferences & Profile Settings')
@Controller('api/users/preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current user notification & interface preferences',
  })
  @ApiResponse({ status: 200, description: 'User preferences' })
  async getPreferences(@CurrentUser('id') userId: string) {
    return this.usersService.getPreferences(userId);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update current user preferences (dark mode, sound, push)',
  })
  @ApiResponse({ status: 200, description: 'Updated preferences' })
  async updatePreferences(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ) {
    return this.usersService.updatePreferences(userId, dto);
  }
}
