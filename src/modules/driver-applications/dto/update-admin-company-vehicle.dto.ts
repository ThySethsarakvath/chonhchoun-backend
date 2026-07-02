import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VehicleStatus } from '../../../common/enum/vehicle-status.enum';

export class UpdateAdminCompanyVehicleDto {
  @IsOptional()
  @IsMongoId()
  branchId?: string | null;

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
