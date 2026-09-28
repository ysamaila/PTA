import { PartialType } from '@nestjs/swagger';
import { CreateHomeworkDto } from './create-homework.dto.js';

export class UpdateHomeworkDto extends PartialType(CreateHomeworkDto) {}
