import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { DriversService } from './drivers.service';
import { CreateDriverDto, UpdateDriverDto } from './dto/driver.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';

@Controller('drivers')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN, Role.BRANCH_OWNER)
export class DriversController {
  constructor(private readonly svc: DriversService) {}

  @Post()
  create(@Body() dto: CreateDriverDto) { return this.svc.create(dto); }

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Get('branch/:branchId/available')
  available(@Param('branchId') branchId: string) {
    return this.svc.findAvailableAtBranch(branchId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.svc.update(id, dto);
  }
}