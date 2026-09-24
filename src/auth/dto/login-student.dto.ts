import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginStudentDto {
  @ApiProperty({
    example: '06201',
    description: 'School-issued 5-character student ID code',
  })
  @IsString()
  @IsNotEmpty()
  @Length(3, 20)
  studentCode: string;

  @ApiProperty({
    example: '1234',
    description: '4 to 6-digit numeric access PIN',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be between 4 and 6 digits' })
  pin: string;
}
