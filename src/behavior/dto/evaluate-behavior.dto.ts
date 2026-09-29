import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BehaviorCategory } from '../../common/enums/index.js';

export class EvaluateBehaviorDto {
  @ApiProperty({
    description: 'UUID of the student being evaluated',
    example: 'd3b07384-d113-4a0e-95af-0b19b6e61234',
  })
  @IsUUID('4')
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: 'UUID of the academic session / term',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsUUID('4')
  @IsNotEmpty()
  academicSessionId: string;

  @ApiProperty({
    description: 'Behavior trait category',
    enum: BehaviorCategory,
    example: BehaviorCategory.TEAMWORK,
  })
  @IsEnum(BehaviorCategory)
  @IsNotEmpty()
  category: BehaviorCategory;

  @ApiProperty({
    description: 'Score from 0 to 100 assessing the student behavior trait',
    minimum: 0,
    maximum: 100,
    example: 88,
  })
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @ApiPropertyOptional({
    description: 'Observational remarks, pastoral comments, or feedback',
    example: 'Consistently demonstrates strong peer collaboration and empathy in group tasks.',
  })
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional({
    description: 'Evaluation date in ISO format (YYYY-MM-DD)',
    example: '2026-09-29',
  })
  @IsOptional()
  @IsDateString()
  evaluationDate?: string;
}
