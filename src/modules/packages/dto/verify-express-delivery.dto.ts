import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export enum ExpressVerificationPurpose {
  PICKUP = 'PICKUP',
  DROPOFF = 'DROPOFF',
}

export class VerifyExpressDeliveryDto {
  @IsEnum(ExpressVerificationPurpose)
  purpose: ExpressVerificationPurpose;

  @IsString()
  @MinLength(32)
  @MaxLength(300)
  token: string;
}
