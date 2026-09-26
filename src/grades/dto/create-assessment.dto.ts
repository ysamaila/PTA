import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { AssessmentType } from '../../common/enums/index.js';

export class CreateAssessmentDto {
  @ApiProperty({
    example: 'd9b2d63d-a233-4f9e-a616-e59c11325c22',
    description: 'Unique UUID of the student receiving the mark',
  })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    example: '8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c',
    description: 'Unique UUID of the academic subject (e.g. Mathematics)',
  })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({
    example: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    description: 'Unique UUID of the academic term/session',
  })
  @IsUUID()
  @IsNotEmpty()
  academicSessionId: string;

  @ApiProperty({
    enum: AssessmentType,
    example: AssessmentType.TEST,
    description: 'Assessment category: QUIZ, TEST, EXAM, HOMEWORK, PROJECT',
  })
  @IsEnum(AssessmentType)
  @IsNotEmpty()
  assessmentType: AssessmentType;

  @ApiProperty({
    example: 'Mid-Term Continuous Assessment',
    description: 'Title or description of the assessment',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  assessmentTitle: string;

  @ApiProperty({
    example: 85.5,
    description: 'Raw score obtained by the student',
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiPropertyOptional({
    example: 100.0,
    description: 'Maximum obtainable score (defaults to 100)',
    default: 100.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0.1)
  totalPossibleMarks?: number;

  @ApiProperty({
    example: '2026-09-26',
    description: 'Evaluation date in ISO8601 YYYY-MM-DD format',
  })
  @IsISO8601()
  @IsNotEmpty()
  evaluationDate: string;

  @ApiPropertyOptional({
    example: 'Strong problem-solving methodology shown in algebra section',
    description: 'Optional teacher remarks or feedback',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  notes?: string;
}
