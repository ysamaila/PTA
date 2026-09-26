import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({
    example: '2024/2025',
    description: 'Academic session year designation',
  })
  @IsString()
  @IsNotEmpty()
  sessionYear: string;

  @ApiProperty({
    example: 'Term 1',
    description: 'Term name (e.g. Term 1, Term 2, Term 3)',
  })
  @IsString()
  @IsNotEmpty()
  termName: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Designates if this is the active current school term',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  isCurrent?: boolean;

  @ApiProperty({
    example: '2024-09-01',
    description: 'Term start date (YYYY-MM-DD)',
  })
  @IsISO8601()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    example: '2024-12-15',
    description: 'Term end date (YYYY-MM-DD)',
  })
  @IsISO8601()
  @IsNotEmpty()
  endDate: string;
}
