import { IsArray, IsEnum, IsInt, IsMongoId, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { DriverStatus, VehicleType } from '../../../shared/schemas/driver.schema';

export class CreateDriverDto {
  @IsMongoId()
  userId: string;

  @IsMongoId()
  currentBranchId: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString() @IsNotEmpty()
  vehiclePlate: string;

  @IsOptional() @IsInt() @Min(0) @Max(86399)
  shiftStart?: number;
 
  @IsOptional() @IsInt() @Min(0) @Max(86399)
  shiftEnd?: number;
 
  @IsOptional() @IsArray() @IsString({ each: true })
  preferredZones?: string[];
}

export class UpdateDriverDto {
  @IsOptional() @IsMongoId()
  currentBranchId?: string;

  @IsOptional() @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional() @IsString()
  vehiclePlate?: string;

  @IsOptional() @IsEnum(DriverStatus)
  status?: DriverStatus;

  @IsOptional() @IsInt() @Min(0) @Max(86399)
  shiftStart?: number;
 
  @IsOptional() @IsInt() @Min(0) @Max(86399)
  shiftEnd?: number;
 
  @IsOptional() @IsArray() @IsString({ each: true })
  preferredZones?: string[];
}