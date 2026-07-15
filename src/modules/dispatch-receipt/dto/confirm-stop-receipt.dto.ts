import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class ConfirmStopReceiptDto {
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  missingShipmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  damagedShipmentIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
