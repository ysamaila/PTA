import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/enums/index.js';
import { ParentsService } from './parents.service.js';
import { LinkStudentDto } from './dto/link-student.dto.js';

@ApiTags('Parent Multi-Child Rostering')
@Controller('api/parents/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARENT)
@ApiBearerAuth()
export class ParentsController {
  constructor(private readonly parentsService: ParentsService) {}

  @Post('link')
  @ApiOperation({
    summary: 'Link an additional child to the authenticated parent account',
  })
  @ApiResponse({ status: 201, description: 'Child linked successfully' })
  @ApiResponse({ status: 404, description: 'Student code not found' })
  @ApiResponse({ status: 409, description: 'Child already linked to account' })
  async linkStudent(
    @CurrentUser('id') parentUserId: string,
    @Body() dto: LinkStudentDto,
  ) {
    return this.parentsService.linkStudent(parentUserId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all children linked to the authenticated parent',
  })
  @ApiResponse({ status: 200, description: 'Array of linked student profiles' })
  async getLinkedStudents(@CurrentUser('id') parentUserId: string) {
    return this.parentsService.getLinkedStudents(parentUserId);
  }

  @Delete(':studentId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlink a child from the authenticated parent' })
  @ApiResponse({ status: 200, description: 'Child unlinked successfully' })
  @ApiResponse({ status: 404, description: 'Linked student not found' })
  async unlinkStudent(
    @CurrentUser('id') parentUserId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.parentsService.unlinkStudent(parentUserId, studentId);
  }
}
