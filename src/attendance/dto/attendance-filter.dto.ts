import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
import { AttendanceStatus } from '../../common/enums/index.js';

export class AttendanceFilterDto {
  @ApiPropertyOptional({
    example: '2026-09-01',
    description: 'Filter attendance records from this date (inclusive, YYYY-MM-DD)',
  })
  @IsISO8601()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Filter attendance records up to this date (inclusive, YYYY-MM-DD)',
  })
  @IsISO8601()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-26',
    description: 'Filter attendance records for a specific single date (YYYY-MM-DD)',
  })
  @IsISO8601()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({
    enum: AttendanceStatus,
    example: AttendanceStatus.ABSENT,
    description: 'Filter attendance by status',
  })
  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;
}
