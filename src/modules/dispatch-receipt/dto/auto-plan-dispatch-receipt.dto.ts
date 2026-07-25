import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AutoPlanDispatchReceiptDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  shipmentIds?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(120)
  timeLimitSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(600)
  simulationDurationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
