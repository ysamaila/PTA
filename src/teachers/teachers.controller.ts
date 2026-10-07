import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/index.js';
import { TeachersService } from './teachers.service.js';
import { CreateStudentDto } from './dto/create-student.dto.js';
import { UpdateStudentDto } from './dto/update-student.dto.js';
import { UploadService } from '../upload/upload.service.js';

@ApiTags('Teacher Classroom & Student Rostering')
@Controller('api/teachers/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
@ApiBearerAuth()
export class TeachersController {
  constructor(
    private readonly teachersService: TeachersService,
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Enroll/roster a new student in teacher classroom',
    description:
      'Creates student profile, internal login account, sets access PIN, and assigns to homeroom roster. Accepts either multipart form with avatar file or JSON with avatarUrl.',
  })
  @ApiResponse({
    status: 201,
    description: 'Student enrolled successfully in classroom roster',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or classroom capacity exceeded',
  })
  @ApiResponse({
    status: 404,
    description: 'Teacher profile not found for authenticated user',
  })
  @ApiResponse({
    status: 409,
    description: 'Student ID code already registered',
  })
  async createStudent(
    @CurrentUser('id') teacherUserId: string,
    @Body() dto: CreateStudentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const avatarFile =
      files?.find((f) =>
        ['avatar', 'file', 'image', 'photo'].includes(f.fieldname),
      ) || files?.[0];

    if (avatarFile) {
      const uploadResult = await this.uploadService.uploadFile(
        avatarFile,
        'pta/avatars',
      );
      dto.avatarUrl = uploadResult.secureUrl;
    }

    return this.teachersService.createStudent(teacherUserId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get classroom roster for authenticated teacher',
    description:
      'Returns teacher classroom metadata and array of enrolled students with linked parent counts.',
  })
  @ApiResponse({
    status: 200,
    description: 'Teacher classroom roster retrieved successfully',
  })
  async getStudents(@CurrentUser('id') teacherUserId: string) {
    return this.teachersService.getStudents(teacherUserId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get single student details from teacher roster',
  })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    description: 'Student details retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found in teacher roster',
  })
  async getStudentById(
    @CurrentUser('id') teacherUserId: string,
    @Param('id') studentId: string,
  ) {
    return this.teachersService.getStudentById(teacherUserId, studentId);
  }

  @Patch(':id')
  @UseInterceptors(AnyFilesInterceptor())
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({
    summary: 'Update student details or avatar image',
    description:
      'Allows teacher to update student name, date of birth, grade, room, or avatarUrl (accepts multipart file or JSON).',
  })
  @ApiParam({ name: 'id', description: 'Student UUID' })
  @ApiResponse({
    status: 200,
    description: 'Student updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Student not found in teacher roster',
  })
  async updateStudent(
    @CurrentUser('id') teacherUserId: string,
    @Param('id') studentId: string,
    @Body() dto: UpdateStudentDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const avatarFile =
      files?.find((f) =>
        ['avatar', 'file', 'image', 'photo'].includes(f.fieldname),
      ) || files?.[0];

    if (avatarFile) {
      const uploadResult = await this.uploadService.uploadFile(
        avatarFile,
        'pta/avatars',
      );
      dto.avatarUrl = uploadResult.secureUrl;
    }

    return this.teachersService.updateStudent(teacherUserId, studentId, dto);
  }
}
