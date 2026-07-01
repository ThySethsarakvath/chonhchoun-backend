import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { DriverAvailabilityStatus } from '../../../common/enum/driver-availability-status.enum';
import { VehicleType } from '../../../common/enum/package.enum';

export class UpdateDriverManagementDto {
  @IsOptional()
  @IsEnum(DriverAvailabilityStatus)
  availabilityStatus?: DriverAvailabilityStatus;

  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @IsOptional()
  @IsDateString()
  licenseExpiry?: string;

  @IsOptional()
  @IsArray()
  @IsEnum(VehicleType, { each: true })
  supportedVehicleTypes?: VehicleType[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLoadWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPackageCount?: number;
}
