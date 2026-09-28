import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { HomeworkStatus } from '../../common/enums/index.js';

export class CreateHomeworkDto {
  @ApiProperty({
    example: '8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c',
    description: 'Unique UUID of the subject for this assignment',
  })
  @IsUUID()
  @IsNotEmpty()
  subjectId: string;

  @ApiProperty({
    example: 'Grade 5',
    description: 'Target grade level (e.g. Grade 5, Grade 6)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  gradeLevel: string;

  @ApiPropertyOptional({
    example: 'Room 201',
    description: 'Specific classroom/room target (e.g. Room 201, Grade 5B)',
    maxLength: 50,
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  room?: string;

  @ApiProperty({
    example: 'Fractions & Decimals Practice',
    description: 'Title of the homework assignment',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({
    example:
      'Complete exercises 1 to 15 on page 42 of the Mathematics workbook.',
    description: 'Detailed instructions and task briefing',
  })
  @IsString()
  @IsNotEmpty()
  instructions: string;

  @ApiProperty({
    example: '2026-10-05',
    description: 'Due date formatted as YYYY-MM-DD',
  })
  @IsISO8601()
  @IsNotEmpty()
  dueDate: string;

  @ApiPropertyOptional({
    enum: HomeworkStatus,
    example: HomeworkStatus.PUBLISHED,
    description:
      'Publication state of the homework (DRAFT, PUBLISHED, ARCHIVED)',
    default: HomeworkStatus.PUBLISHED,
  })
  @IsEnum(HomeworkStatus)
  @IsOptional()
  status?: HomeworkStatus;

  @ApiPropertyOptional({
    example: ['https://storage.connected.edu/worksheets/fractions.pdf'],
    description: 'Array of attachment or reference URLs',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[];
}
