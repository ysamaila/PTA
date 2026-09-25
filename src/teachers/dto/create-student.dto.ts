import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { Gender } from '../../common/enums/index.js';

export class CreateStudentDto {
  @ApiProperty({
    example: 'Divine',
    description: 'First name of the student',
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({
    example: 'Ekubor',
    description: 'Last name of the student',
  })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({
    example: '06201',
    description: 'School-issued unique student identification code',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  studentCode: string;

  @ApiProperty({
    example: '2014-05-14',
    description: 'Student date of birth in ISO8601 format (YYYY-MM-DD)',
  })
  @IsISO8601()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiPropertyOptional({
    enum: Gender,
    example: Gender.MALE,
    default: Gender.OTHER,
  })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({
    example: '1234',
    description: '4 to 6-digit numeric access PIN (defaults to 1234)',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be between 4 and 6 digits' })
  pin?: string;

  @ApiPropertyOptional({
    example: 'Grade 5',
    description: 'Assigned academic grade (defaults to teacher assigned grade)',
  })
  @IsString()
  @IsOptional()
  grade?: string;

  @ApiPropertyOptional({
    example: 'Room 201',
    description: 'Assigned classroom room number (defaults to teacher room)',
  })
  @IsString()
  @IsOptional()
  room?: string;
}
