import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { VehicleType } from '../../../common/enum/package.enum';
import { VehicleStatus } from '../../../common/enum/vehicle-status.enum';

export class CreateBranchVehicleDto {
  @IsString()
  @MinLength(2)
  code: string;

  @IsEnum(VehicleType)
  type: VehicleType;

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
  @IsNumber()
  @Min(0)
  maxWeightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxVolumeM3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPackageCount?: number;
}
