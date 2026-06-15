import { Type } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
  IsDateString,
  IsArray,
  IsUrl,
  MaxLength,
} from 'class-validator';
import {
  PackageType,
  PaymentMethod,
  PaymentPayer,
  VehicleType,
} from '../../../common/enum/package.enum';

// ── Location ──────────────────────────────────────────────────────────────────
export class LocationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contactName: string;

  @IsString()
  @Matches(
    /^(\+855|0)(1[0-9]|2[0-9]|3[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])\d{6,7}$/,
    {
      message: 'Phone must be a valid Cambodian number',
    },
  )
  phone: string;
}

// Pickup extends Location — contactName and phone are optional
// because they default to the logged-in user's data
export class PickupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  address: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  // If omitted, filled from req.user in the service
  @IsOptional()
  @IsString()
  @MaxLength(100)
  contactName?: string;

  // If omitted, filled from req.user in the service
  @IsOptional()
  @IsString()
  @Matches(
    /^(\+855|0)(1[0-9]|2[0-9]|3[0-9]|6[0-9]|7[0-9]|8[0-9]|9[0-9])\d{6,7}$/,
    {
      message: 'Phone must be a valid Cambodian number',
    },
  )
  phone?: string;
}

// ── Package detail ────────────────────────────────────────────────────────────
export class PackageDetailDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsEnum(PackageType)
  type: PackageType;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weightKg?: number;

  @IsOptional()
  @IsArray()
  @IsUrl({}, { each: true })
  images?: string[]; // Cloudinary URLs already uploaded

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ── Payment ───────────────────────────────────────────────────────────────────
export class PaymentDto {
  @IsEnum(PaymentPayer)
  payer: PaymentPayer;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

// ── Main booking DTO ──────────────────────────────────────────────────────────
export class CreateBookingDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ValidateNested()
  @Type(() => PackageDetailDto)
  package: PackageDetailDto;

  @ValidateNested()
  @Type(() => PickupDto)
  pickup: PickupDto;

  @ValidateNested()
  @Type(() => LocationDto)
  dropoff: LocationDto;

  @ValidateNested()
  @Type(() => PaymentDto)
  payment: PaymentDto;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string; // ISO 8601 — null means ASAP
}
