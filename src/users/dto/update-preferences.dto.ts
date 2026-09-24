import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable push notifications',
  })
  @IsBoolean()
  @IsOptional()
  pushNotificationsEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable sound effects',
  })
  @IsBoolean()
  @IsOptional()
  soundEnabled?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Toggle dark mode theme',
  })
  @IsBoolean()
  @IsOptional()
  darkModeEnabled?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Toggle automatic background sync',
  })
  @IsBoolean()
  @IsOptional()
  autoSyncEnabled?: boolean;
}
