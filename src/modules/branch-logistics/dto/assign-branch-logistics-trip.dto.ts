import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AssignBranchLogisticsTripDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsMongoId({ each: true })
  shipmentIds: string[];

  @IsMongoId()
  driverId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
