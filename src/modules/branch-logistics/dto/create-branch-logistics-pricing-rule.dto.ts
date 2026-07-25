import { IsEnum, IsMongoId, IsNumber, IsOptional, Min } from 'class-validator';
import { BranchLogisticsPricingMode } from '../../../common/enum/branch-logistics-pricing-mode.enum';

export class CreateBranchLogisticsPricingRuleDto {
  @IsOptional()
  @IsMongoId()
  senderBranchId?: string;

  @IsOptional()
  @IsMongoId()
  receiverBranchId?: string;

  @IsEnum(BranchLogisticsPricingMode)
  pricingMode: BranchLogisticsPricingMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  pricePerM3?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  routeFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  serviceFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  volumeDivisor?: number;
}
