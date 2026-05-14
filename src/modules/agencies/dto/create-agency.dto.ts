import { IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateAgencyDto {
  @IsNotEmpty()
  @IsString()
  userId: string;

  @IsNotEmpty()
  @IsString()
  branchId: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}