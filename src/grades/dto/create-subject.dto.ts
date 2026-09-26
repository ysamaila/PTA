import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({
    example: 'Mathematics',
    description: 'Academic subject name',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    example: 'MATH-101',
    description: 'Optional subject identification code',
  })
  @IsString()
  @IsOptional()
  code?: string;
}
