import { IsMongoId } from 'class-validator';

export class AssignBranchOwnerDto {
  @IsMongoId()
  userId: string;
}
