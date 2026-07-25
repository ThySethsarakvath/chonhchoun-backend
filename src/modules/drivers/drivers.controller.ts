import { Controller, Get, UseGuards } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enum/role.enum';

@Controller('drivers')
@UseGuards(JwtAuthGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Get('me/earnings')
  @Roles(Role.DRIVER, Role.ADMIN)
  @UseGuards(RolesGuard)
  getMyEarnings(@CurrentUser() user: any) {
    return this.driversService.getMyEarnings(user._id.toString());
  }

  @Get('me/route')
  @Roles(Role.DRIVER, Role.ADMIN)
  @UseGuards(RolesGuard)
  getMyRoute(@CurrentUser() user: any) {
    return this.driversService.getMyRoute(user._id.toString());
  }
}
