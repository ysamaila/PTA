import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({
    example: '11111111-2222-3333-4444-555555555555',
    description: 'UUID of the user to start a direct conversation with',
  })
  @IsUUID()
  @IsNotEmpty()
  recipientUserId: string;

  @ApiPropertyOptional({
    example: 'Hello, I have a question regarding Divine homework.',
    description:
      'Optional initial message to send immediately upon conversation creation',
    maxLength: 5000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(5000)
  initialMessage?: string;
}
