import { IsEnum, IsNotEmpty } from 'class-validator';
import { BookingStatus } from '../../../common/enum/package.enum';

export class UpdatePackageStatusDto {
  @IsNotEmpty()
  @IsEnum(BookingStatus)
  status: BookingStatus;
}
