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
import { GradesService } from './grades.service.js';
import { CreateAssessmentDto } from './dto/create-assessment.dto.js';
import { GradeFilterDto } from './dto/grade-filter.dto.js';
import { CreateSessionDto } from './dto/create-session.dto.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';

@ApiTags('Academic Sessions, Subjects & Continuous Assessment Gradebook')
@Controller('api')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GradesController {
  constructor(private readonly gradesService: GradesService) {}

  // ==========================================
  // ACADEMIC SESSIONS & CURRICULUM SUBJECTS
  // ==========================================

  @Post('academic/sessions')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create or initialize a school academic session / term',
    description:
      'Registers a new academic session with term dates and current active flag.',
  })
  @ApiResponse({
    status: 201,
    description: 'Academic session created successfully',
  })
  async createSession(@Body() dto: CreateSessionDto) {
    return this.gradesService.createSession(dto);
  }

  @Get('academic/sessions')
  @Roles(Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT)
  @ApiOperation({
    summary: 'List all academic sessions and school terms',
  })
  @ApiResponse({ status: 200, description: 'List of academic sessions' })
  async getSessions() {
    return this.gradesService.getSessions();
  }

  @Post('academic/subjects')
  @Roles(Role.ADMIN, Role.TEACHER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add an academic curriculum subject',
    description:
      'Registers a course/subject name and optional course code (e.g. Mathematics MATH-101).',
  })
  @ApiResponse({ status: 201, description: 'Subject created successfully' })
  async createSubject(@Body() dto: CreateSubjectDto) {
    return this.gradesService.createSubject(dto);
  }

  @Get('academic/subjects')
  @Roles(Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT)
  @ApiOperation({
    summary: 'List all curriculum subjects',
  })
  @ApiResponse({ status: 200, description: 'List of subjects' })
  async getSubjects() {
    return this.gradesService.getSubjects();
  }

  // ==========================================
  // GRADEBOOK ASSESSMENTS (GRD-01)
  // ==========================================

  @Post('grades/assessments')
  @Roles(Role.TEACHER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Record a continuous assessment or examination mark for a student (GRD-01)',
    description:
      'Allows teachers to enter assessment scores. Automatically calculates percentage and letter grade (A+, A, B, C, D, F).',
  })
  @ApiResponse({ status: 201, description: 'Grade recorded successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or student not in teacher homeroom',
  })
  @ApiResponse({
    status: 404,
    description: 'Student, subject, or academic session not found',
  })
  async recordAssessment(
    @CurrentUser('id') teacherUserId: string,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.gradesService.recordAssessment(teacherUserId, dto);
  }

  @Get('grades/class')
  @Roles(Role.TEACHER)
  @ApiOperation({
    summary: 'Get classroom gradebook matrix and averages for teacher',
    description:
      'Returns teacher classroom assessments with computed average, highest, and lowest performance metrics.',
  })
  @ApiResponse({
    status: 200,
    description: 'Classroom gradebook retrieved successfully',
  })
  async getClassGrades(
    @CurrentUser('id') teacherUserId: string,
    @Query() filter: GradeFilterDto,
  ) {
    return this.gradesService.getClassGrades(teacherUserId, filter);
  }

  // ==========================================
  // STUDENT REPORT CARD & BADGES (GRD-02, GRD-05)
  // ==========================================

  @Get('grades/student/:studentId')
  @Roles(Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT)
  @ApiOperation({
    summary:
      'Get student academic report card, CA-vs-Exam splits, and badges (GRD-02, GRD-05)',
    description:
      'Calculates subject continuous assessment averages, examination averages, overall grade letters, and dynamic achievement badges with strict RBAC.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    description:
      'Optional academic session UUID (defaults to current active term)',
  })
  @ApiResponse({
    status: 200,
    description: 'Student report card retrieved successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions for this student',
  })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getStudentReportCard(
    @CurrentUser() requester: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.gradesService.getStudentReportCard(
      requester,
      studentId,
      sessionId,
    );
  }
}
