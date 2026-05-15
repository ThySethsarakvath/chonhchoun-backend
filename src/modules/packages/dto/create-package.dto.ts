import { IsNotEmpty, IsNumber, IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';

export class CreatePackageDto {
  @IsNotEmpty()
  @IsString()
  itemName: string;

  @IsOptional()
  @IsString()
  itemDescription?: string;

  @IsNotEmpty()
  @IsEnum(['S', 'M', 'L'])
  size: string;

  @IsNotEmpty()
  @IsNumber()
  weight: number;

  @IsNotEmpty()
  @IsEnum(['document', 'food', 'clothing', 'electronics', 'others'])
  itemType: string;

  @IsNotEmpty()
  @IsEnum(['bike', 'tuktuk'])
  vehicleType: string;

  @IsNotEmpty()
  @IsEnum(['express', 'warehouse'])
  serviceType: string;

  @IsNotEmpty()
  @IsBoolean()
  itemHandling: boolean;

  @IsNotEmpty()
  @IsString()
  pickupAddress: string;

  @IsNotEmpty()
  @IsString()
  dropoffAddress: string;

  @IsNotEmpty()
  @IsNumber()
  pickupLat: number;

  @IsNotEmpty()
  @IsNumber()
  pickupLng: number;

  @IsNotEmpty()
  @IsNumber()
  dropoffLat: number;

  @IsNotEmpty()
  @IsNumber()
  dropoffLng: number;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsNotEmpty()
  @IsEnum(['cash', 'online'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  dropoffContactName?: string;

  @IsOptional()
  @IsString()
  dropoffContactNumber?: string;

  @IsOptional()
  @IsString()
  noteToDriver?: string;
}
