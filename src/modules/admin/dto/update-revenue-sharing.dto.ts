import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateRevenueSharingDto {
  @IsInt()
  @Min(0)
  @Max(100)
  senderBranchPercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  receiverBranchPercent: number;

  @IsInt()
  @Min(0)
  @Max(100)
  companyPercent: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  note?: string;
}
