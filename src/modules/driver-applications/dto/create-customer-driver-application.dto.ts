import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { VehicleType } from '../../../common/enum/package.enum';

export class CreateCustomerDriverApplicationDto {
  @IsMongoId()
  branchId: string;

  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  plateNumber?: string;
}
