import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsNumberString,
  Length,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: 'Six-digit password reset verification code',
  })
  @IsNumberString({}, { message: 'Verification code must be numeric' })
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code!: string;

  @ApiProperty({ example: 'NewSecurePassword123!', minLength: 8 })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  newPassword!: string;
}
