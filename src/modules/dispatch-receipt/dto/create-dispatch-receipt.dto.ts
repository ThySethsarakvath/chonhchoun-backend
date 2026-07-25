import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateDispatchReceiptStopDto {
  @IsInt()
  @Min(1)
  stopOrder: number;

  @IsMongoId()
  destinationBranchId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  shipmentIds: string[];
}

export class CreateDispatchReceiptDto {
  @IsMongoId()
  driverId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateDispatchReceiptStopDto)
  stops: CreateDispatchReceiptStopDto[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
