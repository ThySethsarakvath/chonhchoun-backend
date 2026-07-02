import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleType } from '../../../common/enum/package.enum';
import { VehicleStatus } from '../../../common/enum/vehicle-status.enum';

export class CreateAdminCompanyVehicleDto {
  @IsString()
  @MinLength(2)
  code: string;

  @IsEnum(VehicleType)
  type: VehicleType;

  @IsOptional()
  @IsMongoId()
  branchId?: string;

  @IsOptional()
  @IsString()
  plateNumber?: string;

  @IsOptional()
  @IsString()
  currentWarehouse?: string;

  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWeightKg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxVolumeM3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPackageCount?: number;
}
