import { Type } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, ValidateNested } from 'class-validator';
import { VehicleType } from '../../../common/enum/package.enum';

class QuoteCoordinateDto {
  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;
}

export class QuoteExpressDeliveryDto {
  @IsIn([VehicleType.MOTORCYCLE, VehicleType.RICKSHAW])
  vehicleType: VehicleType;

  @ValidateNested()
  @Type(() => QuoteCoordinateDto)
  pickup: QuoteCoordinateDto;

  @ValidateNested()
  @Type(() => QuoteCoordinateDto)
  dropoff: QuoteCoordinateDto;
}
