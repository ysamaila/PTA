import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { AttendanceStatus } from '../../common/enums/index.js';

export class StudentAttendanceEntryDto {
  @ApiProperty({
    example: 'd9b2d63d-a233-4f9e-a616-e59c11325c22',
    description: 'Unique identifier of the student',
  })
  @IsUUID()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    enum: AttendanceStatus,
    example: AttendanceStatus.PRESENT,
    description: 'Attendance mark for the student',
  })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiPropertyOptional({
    example: 'Arrived 15 minutes late due to bus delay',
    description: 'Optional teacher remarks or notes',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  notes?: string;
}

export class MarkAttendanceDto {
  @ApiProperty({
    example: '2026-09-26',
    description: 'Attendance date in ISO8601 YYYY-MM-DD or full timestamp format',
  })
  @IsISO8601()
  @IsNotEmpty()
  date: string;

  @ApiProperty({
    type: [StudentAttendanceEntryDto],
    description: 'Array of student attendance records for the class roll call',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StudentAttendanceEntryDto)
  records: StudentAttendanceEntryDto[];
}
