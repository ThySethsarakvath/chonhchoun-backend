import { IsEnum } from 'class-validator';
import { DriverAvailabilityStatus } from '../../../common/enum/driver-availability-status.enum';

export class UpdateDriverAvailabilityDto {
  @IsEnum(DriverAvailabilityStatus)
  availabilityStatus!: DriverAvailabilityStatus;
}
