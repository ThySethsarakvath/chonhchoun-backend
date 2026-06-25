import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PackageDetailDto,
  LocationDto,
  PickupDto,
  PaymentDto,
} from './create-booking.dto';
import { VehicleType } from '../../../common/enum/package.enum';

export class UpdateBookingDto {
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @ValidateNested()
  @Type(() => PackageDetailDto)
  package?: PackageDetailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PickupDto)
  pickup?: PickupDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  dropoff?: LocationDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class CancelBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
