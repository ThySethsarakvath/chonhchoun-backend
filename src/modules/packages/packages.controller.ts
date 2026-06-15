import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { CreateWarehousePackageDto, UpdateWarehousePackageDto } from '../../shared/dto/warehouse-package.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';

@Controller('packages')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN, Role.BRANCH_OWNER)
export class PackagesController {
  constructor(private readonly svc: PackagesService) {}

  @Post()
  create(@Body() dto: CreateWarehousePackageDto) { return this.svc.create(dto); }

  @Get()
  findAll(@Query('branchId') branchId?: string, @Query('status') status?: string) {
    return this.svc.findAll(branchId, status);
  }

  @Get('branch/:branchId/pending')
  pendingByBranch(@Param('branchId') branchId: string) {
    return this.svc.findPendingByBranch(branchId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateWarehousePackageDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}