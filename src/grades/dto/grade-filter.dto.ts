import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AssessmentType } from '../../common/enums/index.js';

export class GradeFilterDto {
  @ApiPropertyOptional({
    example: 'd9b2d63d-a233-4f9e-a616-e59c11325c22',
    description: 'Filter grades by student UUID',
  })
  @IsUUID()
  @IsOptional()
  studentId?: string;

  @ApiPropertyOptional({
    example: '8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c',
    description: 'Filter grades by subject UUID',
  })
  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @ApiPropertyOptional({
    example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    description: 'Filter grades by academic session UUID',
  })
  @IsUUID()
  @IsOptional()
  academicSessionId?: string;

  @ApiPropertyOptional({
    enum: AssessmentType,
    example: AssessmentType.EXAM,
    description: 'Filter grades by assessment category',
  })
  @IsEnum(AssessmentType)
  @IsOptional()
  assessmentType?: AssessmentType;
}
