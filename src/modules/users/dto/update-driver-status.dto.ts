import { IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}

export class UpdateDriverStatusDto {
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  currentLocation?: LocationDto;
}
