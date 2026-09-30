import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { BehaviorCategory } from '../../common/enums/index.js';

export class BehaviorFilterDto {
  @ApiPropertyOptional({
    description: 'Filter by academic session UUID',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsOptional()
  @IsUUID('4')
  academicSessionId?: string;

  @ApiPropertyOptional({
    description: 'Filter by grade level (e.g. "Grade 5")',
    example: 'Grade 5',
  })
  @IsOptional()
  @IsString()
  gradeLevel?: string;

  @ApiPropertyOptional({
    description: 'Filter by room number (e.g. "Room 201")',
    example: 'Room 201',
  })
  @IsOptional()
  @IsString()
  room?: string;

  @ApiPropertyOptional({
    description: 'Filter by behavior category',
    enum: BehaviorCategory,
  })
  @IsOptional()
  @IsEnum(BehaviorCategory)
  category?: BehaviorCategory;
}
