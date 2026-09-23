import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumberString, Length } from 'class-validator';

export class VerifyCodeDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @ApiProperty({
    example: '123456',
    description: 'Six-digit verification code',
  })
  @IsNumberString({}, { message: 'Verification code must be numeric' })
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  code!: string;
}
