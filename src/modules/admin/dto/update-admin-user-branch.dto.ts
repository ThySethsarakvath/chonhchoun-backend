import { IsMongoId, IsOptional } from 'class-validator';

export class UpdateAdminUserBranchDto {
  @IsMongoId()
  @IsOptional()
  branchId?: string | null;
}
