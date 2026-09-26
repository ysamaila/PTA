import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/index.js';
import { AttendanceService } from './attendance.service.js';
import { MarkAttendanceDto } from './dto/mark-attendance.dto.js';
import { AttendanceFilterDto } from './dto/attendance-filter.dto.js';

@ApiTags('Daily Attendance Tracking')
@Controller('api/attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('mark')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Submit batch daily attendance roll call for assigned classroom',
    description:
      'Allows teachers to record or update attendance for all students in their classroom in a single batch atomic transaction.',
  })
  @ApiResponse({
    status: 200,
    description: 'Attendance recorded successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or one or more students not enrolled under teacher',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only teachers can mark attendance',
  })
  @ApiResponse({
    status: 404,
    description: 'Teacher profile not found',
  })
  async markClassAttendance(
    @CurrentUser('id') teacherUserId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.attendanceService.markClassAttendance(teacherUserId, dto);
  }

  @Get('class')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Get classroom roll call and live attendance metrics',
    description:
      'Returns teacher classroom attendance records with calculated Present, Late, Absent, and Excused rates.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classroom attendance records retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Teacher profile not found',
  })
  async getClassAttendance(
    @CurrentUser('id') teacherUserId: string,
    @Query() filter: AttendanceFilterDto,
  ) {
    return this.attendanceService.getClassAttendance(teacherUserId, filter);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT)
  @ApiOperation({
    summary: 'Get attendance history for a specific student',
    description:
      'Returns individual student attendance records with strict RBAC enforcement (Students see only self, Parents see only linked children, Teachers see only homeroom students).',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    description: 'Student attendance records retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions for this student',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found',
  })
  async getStudentAttendance(
    @CurrentUser() requester: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Query() filter: AttendanceFilterDto,
  ) {
    return this.attendanceService.getStudentAttendance(requester, studentId, filter);
  }
}
