import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateBehaviorDto {
  @ApiPropertyOptional({
    description: 'Updated score from 0 to 100',
    minimum: 0,
    maximum: 100,
    example: 92,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({
    description: 'Updated observational remarks or comments',
    example:
      'Showed marked improvement in active listening during class debates.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;
}
