import { IsString, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  resetToken: string; // short-lived token issued after OTP is verified

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  newPassword: string;

  @IsString()
  confirmPassword: string;
}
