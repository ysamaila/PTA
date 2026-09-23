import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;
  private readonly senderEmail: string;
  private readonly senderName: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY', '');
    this.senderEmail = this.configService.get<string>(
      'BREVO_SENDER_EMAIL',
      'yusuf.hilside@gmail.com',
    );
    this.senderName = this.configService.get<string>(
      'BREVO_SENDER_NAME',
      'PTA',
    );
  }

  async sendVerificationCode(
    toEmail: string,
    recipientName: string,
    code: string,
  ): Promise<boolean> {
    const subject = 'Your 6-Digit Verification Code - PTA';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">Welcome to PTA</h2>
        <p style="color: #475569; font-size: 16px;">Hello ${recipientName || 'there'},</p>
        <p style="color: #475569; font-size: 16px;">Use the verification code below to confirm your email address and activate your account:</p>
        <div style="background-color: #f1f5f9; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0f172a;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code is valid for 10 minutes. If you did not request this registration, please disregard this message.</p>
      </div>
    `;
    const textContent = `Hello ${recipientName || 'there'},\n\nYour PTA verification code is: ${code}\nThis code will expire in 10 minutes.`;

    return this.dispatchEmail(
      toEmail,
      recipientName,
      subject,
      htmlContent,
      textContent,
      'Verification code',
    );
  }

  async sendPasswordResetCode(
    toEmail: string,
    recipientName: string,
    code: string,
  ): Promise<boolean> {
    const subject = 'Reset Your Password - PTA';
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #1e293b; margin-bottom: 16px;">PTA Password Reset</h2>
        <p style="color: #475569; font-size: 16px;">Hello ${recipientName || 'there'},</p>
        <p style="color: #475569; font-size: 16px;">We received a request to reset your password. Use the 6-digit code below to set a new password:</p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #991b1b;">${code}</span>
        </div>
        <p style="color: #64748b; font-size: 14px;">This code is valid for 10 minutes. If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `;
    const textContent = `Hello ${recipientName || 'there'},\n\nYour PTA password reset code is: ${code}\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.`;

    return this.dispatchEmail(
      toEmail,
      recipientName,
      subject,
      htmlContent,
      textContent,
      'Password reset code',
    );
  }

  private async dispatchEmail(
    toEmail: string,
    recipientName: string,
    subject: string,
    htmlContent: string,
    textContent: string,
    actionType: string,
  ): Promise<boolean> {
    if (!this.apiKey || this.apiKey.includes('your_brevo_api_key')) {
      this.logger.warn(
        `Brevo API key not configured. Mock delivery of ${actionType} to ${toEmail}`,
      );
      return true;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.senderName,
            email: this.senderEmail,
          },
          to: [{ email: toEmail, name: recipientName || toEmail }],
          subject,
          htmlContent,
          textContent,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Brevo email delivery failed [${response.status}]: ${errorText}`,
        );
        return false;
      }

      const data = (await response.json().catch(() => ({}))) as {
        messageId?: string;
      };
      this.logger.log(
        `${actionType} successfully dispatched via Brevo to ${toEmail}${data.messageId ? ` [MessageID: ${data.messageId}]` : ''}`,
      );
      return true;
    } catch (err) {
      this.logger.error(
        `Exception during Brevo email dispatch: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
