import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterParentDto } from './dto/register-parent.dto.js';
import { RegisterTeacherDto } from './dto/register-teacher.dto.js';
import { RegisterAdminDto } from './dto/register-admin.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyCodeDto } from './dto/verify-code.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginStudentDto } from './dto/login-student.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Authentication')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('parent/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new parent account' })
  @ApiResponse({
    status: 201,
    description:
      'Parent registered successfully and verification code dispatched',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async registerParent(@Body() dto: RegisterParentDto) {
    return this.authService.registerParent(dto);
  }

  @Post('teacher/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new teacher account' })
  @ApiResponse({
    status: 201,
    description:
      'Teacher registered successfully and verification code dispatched',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async registerTeacher(@Body() dto: RegisterTeacherDto) {
    return this.authService.registerTeacher(dto);
  }

  @Post('admin/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new admin account' })
  @ApiResponse({
    status: 201,
    description:
      'Admin registered successfully and verification code dispatched',
  })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.authService.registerAdmin(dto);
  }

  @Post('verify-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email using 6-digit code delivered via Brevo',
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired verification code',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async verifyCode(@Body() dto: VerifyCodeDto) {
    return this.authService.verifyEmailCode(dto);
  }

  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend 6-digit verification code' })
  @ApiResponse({
    status: 200,
    description: 'Verification code resent if account exists',
  })
  @ApiResponse({ status: 400, description: 'Rate limit or already verified' })
  async resendCode(@Body() dto: ResendCodeDto) {
    return this.authService.resendVerificationCode(dto);
  }

  @Post('parent/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as a parent' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns tokens and user',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or role mismatch',
  })
  @ApiResponse({
    status: 403,
    description: 'Account pending verification, suspended, or disabled',
  })
  async loginParent(@Body() dto: LoginDto) {
    return this.authService.loginParent(dto);
  }

  @Post('teacher/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as a teacher' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns tokens and user',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or role mismatch',
  })
  @ApiResponse({
    status: 403,
    description: 'Account pending approval, suspended, or disabled',
  })
  async loginTeacher(@Body() dto: LoginDto) {
    return this.authService.loginTeacher(dto);
  }

  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as an administrator' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns tokens and user',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials or role mismatch',
  })
  @ApiResponse({
    status: 403,
    description: 'Account pending verification, suspended, or disabled',
  })
  async loginAdmin(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto);
  }

  @Post('student/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in as a student using Student ID and PIN' })
  @ApiResponse({
    status: 200,
    description: 'Login successful, returns tokens and student profile',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid student ID or PIN',
  })
  async loginStudent(@Body() dto: LoginStudentDto) {
    return this.authService.loginStudent(dto);
  }


  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate and exchange a refresh token for new tokens',
  })
  @ApiResponse({ status: 200, description: 'Token rotated successfully' })
  @ApiResponse({
    status: 401,
    description: 'Invalid, expired, or reused refresh token',
  })
  async refreshTokens(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and invalidate active session tokens' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @CurrentUser('id') userId: string,
    @Body() dto?: Partial<RefreshTokenDto>,
  ) {
    return this.authService.logout(userId, dto?.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Initiate password reset flow by sending a 6-digit OTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset code sent if account exists',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or rate limited',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset account password using 6-digit OTP code' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successful',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or max-attempt exceeded reset code',
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for currently authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid new password' })
  @ApiResponse({
    status: 401,
    description: 'Current password mismatch or unauthorized',
  })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }
}
