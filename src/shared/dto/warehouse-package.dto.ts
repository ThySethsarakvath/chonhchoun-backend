import {
  IsEnum, IsMongoId, IsNotEmpty, IsNumber, IsOptional, IsString, Min,
} from 'class-validator';
import { PackagePriority } from '../schemas/warehouse-package.schema';

export class CreateWarehousePackageDto {
  @IsMongoId()
  sourceBranchId: string;

  @IsMongoId()
  destinationBranchId: string;

  @IsString() @IsNotEmpty()
  description: string;

  @IsNumber() @Min(0.1)
  weightKg?: number;

  @IsOptional() @IsEnum(PackagePriority)
  priority?: PackagePriority;

  @IsOptional() @IsString()
  note?: string;
}

export class UpdateWarehousePackageDto {
  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsNumber() @Min(0.1)
  weightKg?: number;

  @IsOptional() @IsEnum(PackagePriority)
  priority?: PackagePriority;

  @IsOptional() @IsString()
  note?: string;
}