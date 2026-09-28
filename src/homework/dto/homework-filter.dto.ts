import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { HomeworkStatus } from '../../common/enums/index.js';

export class HomeworkFilterDto {
  @ApiPropertyOptional({
    description: 'Filter assignments by subject UUID',
  })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({
    description: 'Filter assignments by grade level (e.g. Grade 5)',
  })
  @IsString()
  @IsOptional()
  gradeLevel?: string;

  @ApiPropertyOptional({
    description:
      'Filter assignments by room/classroom (e.g. Room 201, Grade 5B)',
  })
  @IsString()
  @IsOptional()
  room?: string;

  @ApiPropertyOptional({
    enum: HomeworkStatus,
    description:
      'Filter assignments by publication status (DRAFT, PUBLISHED, ARCHIVED)',
  })
  @IsEnum(HomeworkStatus)
  @IsOptional()
  status?: HomeworkStatus;
}
