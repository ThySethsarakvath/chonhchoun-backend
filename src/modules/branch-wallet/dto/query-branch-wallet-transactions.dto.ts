import { IsEnum, IsOptional, IsString } from 'class-validator';
import { BranchWalletTransactionStatus } from '../../../common/enum/branch-wallet-transaction-status.enum';
import { BranchWalletTransactionType } from '../../../common/enum/branch-wallet-transaction-type.enum';

export class QueryBranchWalletTransactionsDto {
  @IsOptional()
  @IsEnum(BranchWalletTransactionStatus)
  status?: BranchWalletTransactionStatus;

  @IsOptional()
  @IsEnum(BranchWalletTransactionType)
  type?: BranchWalletTransactionType;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
