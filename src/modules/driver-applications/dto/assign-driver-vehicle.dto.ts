import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { DriverVehicleAssignmentType } from '../../../common/enum/driver-vehicle-assignment-type.enum';

export class AssignDriverVehicleDto {
  @IsMongoId()
  vehicleId: string;

  @IsOptional()
  @IsEnum(DriverVehicleAssignmentType)
  assignmentType?: DriverVehicleAssignmentType;
}
