import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  async sendPasswordResetOtp(email: string, otp: string, name: string): Promise<void> {
    await this.mailer.sendMail({
      to: email,
      subject: 'Your password reset PIN — Chonhchoun',
      html: this.buildOtpEmail(name, otp),
    });
    this.logger.log(`Password reset OTP sent to ${email}`);
  }

  private buildOtpEmail(name: string, otp: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px;">Reset your password</h2>
        <p style="font-size: 14px; color: #555; margin: 0 0 24px;">Hi ${name}, use the PIN below to reset your Chonhchoun password.</p>

        <div style="background: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <p style="font-size: 13px; color: #888; margin: 0 0 8px; letter-spacing: 0.04em; text-transform: uppercase;">Your PIN</p>
          <p style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #1a1a1a; margin: 0;">${otp}</p>
        </div>

        <p style="font-size: 13px; color: #888; margin: 0 0 6px;">This PIN expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 13px; color: #888; margin: 0 0 24px;">You have <strong>5 attempts</strong> before it is locked.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 24px;">
        <p style="font-size: 12px; color: #bbb; margin: 0;">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
      </div>
    `;
  }
}