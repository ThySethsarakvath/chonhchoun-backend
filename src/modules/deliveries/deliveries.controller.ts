import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';
import { IsOptional, IsString } from 'class-validator';

class CompleteRouteDto {
  @IsString() driverId: string;
}

class CancelDto {
  @IsOptional() @IsString() reason?: string;
}

@Controller('deliveries')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN, Role.BRANCH_OWNER, Role.DRIVER)
export class DeliveriesController {
  constructor(private readonly svc: DeliveriesService) {}

  @Get()
  findAll(@Query('branchId') branchId?: string) {
    return this.svc.findAll(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  // Mark one driver's route as completed
  @Patch(':id/complete-route')
  completeRoute(@Param('id') id: string, @Body() dto: CompleteRouteDto) {
    return this.svc.markDriverCompleted(id, dto.driverId);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelDto) {
    return this.svc.cancel(id, dto.reason);
  }
}