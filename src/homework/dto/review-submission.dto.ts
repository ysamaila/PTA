import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { SubmissionStatus } from '../../common/enums/index.js';

export class ReviewSubmissionDto {
  @ApiPropertyOptional({
    enum: SubmissionStatus,
    example: SubmissionStatus.REVIEWED,
    description: 'Updated submission status (SUBMITTED or REVIEWED)',
    default: SubmissionStatus.REVIEWED,
  })
  @IsEnum(SubmissionStatus)
  @IsOptional()
  status?: SubmissionStatus;
}
