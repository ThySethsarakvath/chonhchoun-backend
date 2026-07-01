import {
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { BranchLogisticsPricingMode } from '../../../common/enum/branch-logistics-pricing-mode.enum';

export class CreateBranchLogisticsShipmentDto {
  @IsMongoId()
  receiverBranchId: string;

  @IsOptional()
  @IsMongoId()
  senderUserId?: string;

  @IsOptional()
  @IsMongoId()
  receiverUserId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  senderName: string;

  @IsString()
  senderPhone: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  receiverName: string;

  @IsString()
  receiverPhone: string;

  @IsString()
  @MinLength(2)
  @MaxLength(300)
  itemDescription: string;

  @IsEnum(BranchLogisticsPricingMode)
  pricingMode: BranchLogisticsPricingMode;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  widthCm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  heightCm?: number;

  @IsOptional()
  @IsNumber()
  extraFee?: number;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
