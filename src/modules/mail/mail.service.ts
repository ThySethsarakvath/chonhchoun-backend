import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly mailer: MailerService) {}

  // ── Password reset OTP ───────────────────────────────────────────────────────
  async sendPasswordResetOtp(
    email: string,
    otp: string,
    name: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to: email,
      subject: 'Your password reset PIN — Chonhchoun',
      html: this.buildOtpEmail({
        name,
        otp,
        title: 'Reset your password',
        bodyText: 'Use the PIN below to reset your Chonhchoun password.',
        footerText:
          "If you didn't request this, you can safely ignore this email.",
      }),
    });
    this.logger.log(`Password reset OTP sent to ${email}`);
  }

  // ── Registration OTP ─────────────────────────────────────────────────────────
  async sendRegistrationOtp(
    email: string,
    otp: string,
    name: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to: email,
      subject: 'Verify your email — Chonhchoun',
      html: this.buildOtpEmail({
        name,
        otp,
        title: 'Verify your email address',
        bodyText:
          'Welcome to Chonhchoun! Use the PIN below to verify your email and complete your registration.',
        footerText:
          "If you didn't create an account, you can safely ignore this email.",
      }),
    });
    this.logger.log(`Registration OTP sent to ${email}`);
  }

  async sendDriverApplicationApproved(
    email: string,
    name: string,
    branchName: string,
  ): Promise<void> {
    await this.mailer.sendMail({
      to: email,
      subject: 'Driver application approved - Chonhchoun',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
          <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 12px;">Your driver application was approved</h2>
          <p style="font-size: 14px; color: #555; margin: 0 0 16px;">Hi ${name},</p>
          <p style="font-size: 14px; color: #555; margin: 0 0 16px;">
            Your application to work with <strong>${branchName}</strong> has been accepted by the branch owner.
          </p>
          <p style="font-size: 14px; color: #555; margin: 0 0 24px;">
            You can now sign in to Chonhchoun using the email and password you submitted during your driver registration.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 24px;">
          <p style="font-size: 12px; color: #bbb; margin: 0;">If you did not submit this application, please contact support.</p>
        </div>
      `,
    });
    this.logger.log(`Driver approval email sent to ${email}`);
  }

  // ── Shared HTML builder ──────────────────────────────────────────────────────
  private buildOtpEmail(opts: {
    name: string;
    otp: string;
    title: string;
    bodyText: string;
    footerText: string;
  }): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
        <h2 style="font-size: 20px; font-weight: 600; color: #1a1a1a; margin: 0 0 8px;">${opts.title}</h2>
        <p style="font-size: 14px; color: #555; margin: 0 0 24px;">Hi ${opts.name}, ${opts.bodyText}</p>

        <div style="background: #f5f5f5; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 24px;">
          <p style="font-size: 13px; color: #888; margin: 0 0 8px; letter-spacing: 0.04em; text-transform: uppercase;">Your PIN</p>
          <p style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #1a1a1a; margin: 0;">${opts.otp}</p>
        </div>

        <p style="font-size: 13px; color: #888; margin: 0 0 6px;">This PIN expires in <strong>10 minutes</strong>.</p>
        <p style="font-size: 13px; color: #888; margin: 0 0 24px;">You have <strong>5 attempts</strong> before it is locked.</p>

        <hr style="border: none; border-top: 1px solid #eee; margin: 0 0 24px;">
        <p style="font-size: 12px; color: #bbb; margin: 0;">${opts.footerText}</p>
      </div>
    `;
  }
}
