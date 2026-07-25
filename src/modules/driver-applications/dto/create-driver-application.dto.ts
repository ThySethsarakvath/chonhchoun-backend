import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { VehicleType } from '../../../common/enum/package.enum';

export class CreateDriverApplicationDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(
    /^(\+855|0)(1[0-9]|2[0-9]|3[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])\d{6,7}$/,
    {
      message:
        'Phone number must be a valid Cambodian number. Accepted formats: 012345678 or +85512345678',
    },
  )
  phone: string;

  @IsString()
  @MinLength(6)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'Password must contain at least one letter and one number',
  })
  password: string;

  @IsString()
  confirmPassword: string;

  @IsMongoId()
  branchId: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  plateNumber?: string;
}
