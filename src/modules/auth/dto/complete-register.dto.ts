import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Role } from '../../../common/enum/role.enum';

export class CompleteRegisterDto {
  @IsString()
  setupToken: string; // issued after OTP verified — proves email ownership

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;

  @IsString()
  confirmPassword: string;

  @IsEnum(Role)
  @IsOptional()
  role?: Role; // defaults to CUSTOMER if omitted
}