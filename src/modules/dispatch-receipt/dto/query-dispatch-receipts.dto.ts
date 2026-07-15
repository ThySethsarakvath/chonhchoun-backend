import { IsEnum, IsOptional, IsString } from 'class-validator';
import { DispatchReceiptStatus } from '../../../common/enum/dispatch-receipt-status.enum';

export class QueryDispatchReceiptsDto {
  @IsOptional()
  @IsEnum(DispatchReceiptStatus)
  status?: DispatchReceiptStatus;

  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
