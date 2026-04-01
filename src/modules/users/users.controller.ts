import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // all routes in this controller require auth
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /api/v1/users  ← admin only
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // GET /api/v1/users/drivers  ← admin + agency
  @Get('drivers')
  @Roles(Role.ADMIN, Role.AGENCY)
  findDrivers() {
    return this.usersService.findByRole(Role.DRIVER);
  }

  // GET /api/v1/users/:id  ← admin only
  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  // PATCH /api/v1/users/:id/deactivate  ← admin only
  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}