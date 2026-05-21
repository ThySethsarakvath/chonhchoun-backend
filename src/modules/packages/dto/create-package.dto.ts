import {
  IsEnum,
  IsString,
  IsNumber,
  IsObject,
  IsArray,
  IsDate,
  ValidateNested,
  IsOptional,
  Min,
  MinLength,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  VehicleType,
  PackageType,
  PaymentMethod,
  PayerType,
} from '../../../common/enum/package.enum';

export class LocationDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  address: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class ContactDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  phone: string;
}

export class PackageItemDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsEnum(PackageType)
  type: PackageType;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PickupDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @IsDate()
  @Type(() => Date)
  scheduledAt: Date;
}

export class DropoffDto {
  @IsObject()
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @IsObject()
  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;
}

export class PaymentDto {
  @IsEnum(PayerType)
  payer: PayerType;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedCost?: number;
}


export class CreatePackageDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  items: PackageItemDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => PickupDto)
  pickup: PickupDto;

  @IsObject()
  @ValidateNested()
  @Type(() => DropoffDto)
  dropoff: DropoffDto;

  @IsObject()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment: PaymentDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class UpdatePackageDto {
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  items?: PackageItemDto[];

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PickupDto)
  pickup?: PickupDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => DropoffDto)
  dropoff?: DropoffDto;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PaymentDto)
  payment?: PaymentDto;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ListPackagesQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  status?: string; // Can filter by single status

  @IsOptional()
  @IsString()
  vehicleType?: string; // Can filter by vehicle type

  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  order?: 'asc' | 'desc' = 'desc';
}
