import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BranchLogisticsStatus } from '../../../common/enum/branch-logistics-status.enum';

export class QueryBranchLogisticsShipmentsDto {
  @IsOptional()
  @IsString()
  direction?: 'outbound' | 'inbound' | 'all';

  @IsOptional()
  @IsEnum(BranchLogisticsStatus)
  status?: BranchLogisticsStatus;

  @IsOptional()
  @IsString()
  ticketNumber?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
