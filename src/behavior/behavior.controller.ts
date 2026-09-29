import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { BehaviorService } from './behavior.service.js';
import { EvaluateBehaviorDto } from './dto/evaluate-behavior.dto.js';
import { UpdateBehaviorDto } from './dto/update-behavior.dto.js';
import { BehaviorFilterDto } from './dto/behavior-filter.dto.js';

@ApiTags('Pastoral Care & Behavior Tracking')
@Controller('api/behavior')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BehaviorController {
  constructor(private readonly behaviorService: BehaviorService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record or update pastoral care / behavior evaluation for a student',
    description:
      'Allows teachers to score students across core behavior categories (Teamwork, Communication, Respect, Responsibility). Upserts existing session record.',
  })
  @ApiResponse({ status: 201, description: 'Behavior evaluation recorded successfully' })
  @ApiResponse({ status: 400, description: 'Student not in assigned classroom roster or invalid payload' })
  @ApiResponse({ status: 404, description: 'Student, teacher, or academic session not found' })
  async evaluateBehavior(
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: Role,
    @Body() dto: EvaluateBehaviorDto,
  ) {
    return this.behaviorService.evaluateBehavior(requesterId, requesterRole, dto);
  }

  @Get('classroom')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Get classroom behavior matrix, student score breakdowns, and pastoral statistics',
    description:
      'Provides a classroom-wide view of all student behavior metrics across categories, including class averages and students needing support.',
  })
  @ApiResponse({ status: 200, description: 'Classroom behavior matrix retrieved successfully' })
  async getClassroomBehavior(
    @CurrentUser() requester: AuthenticatedUser,
    @Query() filter: BehaviorFilterDto,
  ) {
    return this.behaviorService.getClassroomBehavior(requester, filter);
  }

  @Get('student/:studentId/session/:sessionId')
  @Roles(Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT)
  @ApiOperation({
    summary: 'Get student behavior evaluation report for a specific academic session',
    description:
      'Returns per-category scores, character badges, teacher remarks, and overall rating for parents, teachers, and students.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiParam({ name: 'sessionId', description: 'Academic Session UUID' })
  @ApiResponse({ status: 200, description: 'Student behavior report retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized to view this student behavior record' })
  @ApiResponse({ status: 404, description: 'Student or academic session not found' })
  async getStudentBehaviorBySession(
    @CurrentUser() requester: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Param('sessionId') sessionId: string,
  ) {
    return this.behaviorService.getStudentBehavior(requester, studentId, sessionId);
  }

  @Get('student/:studentId')
  @Roles(Role.ADMIN, Role.TEACHER, Role.PARENT, Role.STUDENT)
  @ApiOperation({
    summary: 'Get student behavior report for current or specified academic session',
    description:
      'Returns student behavior record and badges, defaulting to the currently active academic session.',
  })
  @ApiParam({ name: 'studentId', description: 'Student UUID' })
  @ApiQuery({
    name: 'sessionId',
    required: false,
    description: 'Optional academic session UUID (defaults to active term)',
  })
  @ApiResponse({ status: 200, description: 'Student behavior report retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not authorized to view this student behavior record' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getStudentBehavior(
    @CurrentUser() requester: AuthenticatedUser,
    @Param('studentId') studentId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    return this.behaviorService.getStudentBehavior(requester, studentId, sessionId);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Update an existing behavior evaluation record',
    description: 'Allows modifying score and pastoral remarks for a previously saved behavior record.',
  })
  @ApiParam({ name: 'id', description: 'Behavior record UUID' })
  @ApiResponse({ status: 200, description: 'Behavior record updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the original recording teacher' })
  @ApiResponse({ status: 404, description: 'Behavior record not found' })
  async updateBehavior(
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: Role,
    @Param('id') id: string,
    @Body() dto: UpdateBehaviorDto,
  ) {
    return this.behaviorService.updateBehavior(
      requesterId,
      id,
      dto,
      requesterRole === Role.ADMIN,
    );
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'Delete a behavior evaluation record',
    description: 'Removes an erroneous behavior evaluation record.',
  })
  @ApiParam({ name: 'id', description: 'Behavior record UUID' })
  @ApiResponse({ status: 200, description: 'Behavior record deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - not the original recording teacher' })
  @ApiResponse({ status: 404, description: 'Behavior record not found' })
  async deleteBehavior(
    @CurrentUser('id') requesterId: string,
    @CurrentUser('role') requesterRole: Role,
    @Param('id') id: string,
  ) {
    return this.behaviorService.deleteBehavior(
      requesterId,
      id,
      requesterRole === Role.ADMIN,
    );
  }
}
