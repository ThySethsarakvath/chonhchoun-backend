import { SetMetadata } from '@nestjs/common';
import { Role } from '../../../common/enum/role.enum';

export const ROLES_KEY = 'roles';

// Usage: @Roles(Role.ADMIN, Role.DRIVER)
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
