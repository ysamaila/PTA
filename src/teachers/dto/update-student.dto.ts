import { PartialType } from '@nestjs/swagger';
import { CreateStudentDto } from './create-student.dto.js';

export class UpdateStudentDto extends PartialType(CreateStudentDto) {}
