import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterTeacherDto {
  @ApiPropertyOptional({ example: 'teacher' })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiProperty({ example: 'Mr. David Clark' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @ApiProperty({ example: 'teacher@school.edu' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Invalid work email address' })
  @IsNotEmpty({ message: 'Work email is required' })
  workEmail!: string;

  @ApiPropertyOptional({ example: 'teacher@school.edu' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @ApiProperty({ example: 'Oakridge International Academy' })
  @IsString()
  @IsNotEmpty({ message: 'School name is required' })
  schoolName!: string;

  @ApiProperty({ example: 'T@acherPass123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;

  @ApiProperty({ example: 'T@acherPass123', minLength: 8 })
  @IsString()
  @IsNotEmpty({ message: 'Confirm password is required' })
  confirmPassword!: string;

  @ApiProperty({ example: true })
  @IsBoolean({ message: 'termsAccepted must be a boolean' })
  @Equals(true, { message: 'Terms and conditions must be accepted' })
  termsAccepted!: boolean;

  @ApiPropertyOptional({ example: '+1234567891' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Mathematics & Science' })
  @IsOptional()
  @IsString()
  subjectSpecialization?: string;
}
