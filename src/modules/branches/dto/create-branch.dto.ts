import { IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBranchDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsString() @IsNotEmpty()
  address: string;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsString() @IsNotEmpty()
  phone: string;
}

export class UpdateBranchDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsLatitude()
  latitude?: number;

  @IsOptional() @IsLongitude()
  longitude?: number;

  @IsOptional() @IsString()
  phone?: string;
}