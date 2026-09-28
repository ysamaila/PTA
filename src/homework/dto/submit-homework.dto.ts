import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

export class SubmitHomeworkDto {
  @ApiPropertyOptional({
    example: 'Completed all problems; checked work with study guide.',
    description: 'Student submission notes or reflections',
  })
  @IsString()
  @IsOptional()
  submissionNotes?: string;

  @ApiPropertyOptional({
    example: [
      'https://storage.connected.edu/submissions/divine_fractions_scan.pdf',
    ],
    description: 'URLs to submitted files, scans, or google docs',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachmentUrls?: string[];
}
