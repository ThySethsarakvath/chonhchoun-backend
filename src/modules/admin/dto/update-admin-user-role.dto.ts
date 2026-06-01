import { IsEnum } from 'class-validator';
import { Role } from '../../../common/enum/role.enum';

export class UpdateAdminUserRoleDto {
  @IsEnum(Role)
  role: Role;
}
