import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBranchLogisticsStatusDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
