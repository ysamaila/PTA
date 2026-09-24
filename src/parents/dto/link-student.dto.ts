import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class LinkStudentDto {
  @ApiProperty({
    example: '06201',
    description: 'School-issued Student ID code to link to your account',
  })
  @IsString()
  @IsNotEmpty()
  studentCode: string;

  @ApiPropertyOptional({
    example: 'Mother',
    default: 'Parent',
    description: 'Relationship of parent/guardian to child',
  })
  @IsString()
  @IsOptional()
  relationshipType?: string;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description: 'Whether this parent is the primary emergency contact',
  })
  @IsBoolean()
  @IsOptional()
  isPrimaryContact?: boolean;
}
