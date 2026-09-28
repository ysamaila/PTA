import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HomeworkService } from './homework.service.js';
import { CreateHomeworkDto } from './dto/create-homework.dto.js';
import { UpdateHomeworkDto } from './dto/update-homework.dto.js';
import { HomeworkFilterDto } from './dto/homework-filter.dto.js';
import { SubmitHomeworkDto } from './dto/submit-homework.dto.js';
import { ReviewSubmissionDto } from './dto/review-submission.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/index.js';

@ApiTags('Homework & Assignments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/homework')
export class HomeworkController {
  constructor(private readonly homeworkService: HomeworkService) {}

  @Post()
  @Roles(Role.TEACHER, Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create and publish a new homework assignment' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Homework assignment successfully created',
  })
  createHomework(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateHomeworkDto,
  ) {
    return this.homeworkService.createHomework(userId, dto);
  }

  @Get()
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({
    summary: 'List homework created by teacher or all (if admin)',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of homework assignments retrieved successfully',
  })
  getTeacherHomework(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Query() filter: HomeworkFilterDto,
  ) {
    return this.homeworkService.getTeacherHomework(
      userId,
      filter,
      role === Role.ADMIN,
    );
  }

  @Get('student/my-homework')
  @Roles(Role.STUDENT)
  @ApiOperation({
    summary: 'Get all homework assigned to the student with submission status',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Student homework list retrieved successfully',
  })
  getStudentHomework(@CurrentUser('id') studentUserId: string) {
    return this.homeworkService.getStudentHomework(studentUserId);
  }

  @Get('parent/student/:studentId')
  @Roles(Role.PARENT)
  @ApiOperation({
    summary: 'View homework assigned to a linked child',
  })
  @ApiParam({
    name: 'studentId',
    description: 'UUID of the linked student',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Child homework list retrieved successfully',
  })
  getParentStudentHomework(
    @CurrentUser('id') parentUserId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
  ) {
    return this.homeworkService.getParentStudentHomework(
      parentUserId,
      studentId,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get details and submission statistics for a homework assignment',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the homework assignment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Homework details retrieved successfully',
  })
  getHomeworkById(@Param('id', ParseUUIDPipe) id: string) {
    return this.homeworkService.getHomeworkById(id);
  }

  @Patch(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Update homework assignment details' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the homework assignment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Homework updated successfully',
  })
  updateHomework(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: UpdateHomeworkDto,
  ) {
    return this.homeworkService.updateHomework(
      id,
      userId,
      dto,
      role === Role.ADMIN,
    );
  }

  @Delete(':id')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Delete homework assignment' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the homework assignment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Homework assignment deleted successfully',
  })
  deleteHomework(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: Role,
  ) {
    return this.homeworkService.deleteHomework(id, userId, role === Role.ADMIN);
  }

  @Post(':id/submit')
  @Roles(Role.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit homework assignment as student' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the homework assignment',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Homework submitted successfully',
  })
  submitHomework(
    @Param('id', ParseUUIDPipe) homeworkId: string,
    @CurrentUser('id') studentUserId: string,
    @Body() dto: SubmitHomeworkDto,
  ) {
    return this.homeworkService.submitHomework(homeworkId, studentUserId, dto);
  }

  @Patch(':id/parent-sign/:studentId')
  @Roles(Role.PARENT)
  @ApiOperation({
    summary: 'Sign and verify child completed homework assignment as parent',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the homework assignment',
  })
  @ApiParam({
    name: 'studentId',
    description: 'UUID of the student',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Homework submission signed by parent successfully',
  })
  parentSignHomework(
    @Param('id', ParseUUIDPipe) homeworkId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser('id') parentUserId: string,
  ) {
    return this.homeworkService.parentSignHomework(
      homeworkId,
      studentId,
      parentUserId,
    );
  }

  @Patch(':id/submissions/:studentId/review')
  @Roles(Role.TEACHER, Role.ADMIN)
  @ApiOperation({ summary: 'Mark student submission as reviewed' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the homework assignment',
  })
  @ApiParam({
    name: 'studentId',
    description: 'UUID of the student',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Submission reviewed successfully',
  })
  reviewSubmission(
    @Param('id', ParseUUIDPipe) homeworkId: string,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser('id') teacherUserId: string,
    @CurrentUser('role') role: Role,
    @Body() dto: ReviewSubmissionDto,
  ) {
    return this.homeworkService.reviewSubmission(
      homeworkId,
      studentId,
      teacherUserId,
      dto,
      role === Role.ADMIN,
    );
  }
}
