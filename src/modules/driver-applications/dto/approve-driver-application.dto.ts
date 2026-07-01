import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { VehicleType } from '../../../common/enum/package.enum';

export class ApproveDriverApplicationDto {
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @IsOptional()
  @IsString()
  @MinLength(2)
  assignedVehicleCode?: string;
}
