import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { WarehousePackagesService } from './warehouse-packages.service';
import { CreateWarehousePackageDto, UpdateWarehousePackageDto } from '../../shared/dto/warehouse-package.dto';
import { WarehousePackageStatus } from '../../shared/schemas/warehouse-package.schema';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enum/role.enum';

@Controller('warehouse-packages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousePackagesController {
  constructor(private readonly service: WarehousePackagesService) {}

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateWarehousePackageDto) {
    return this.service.createWarehousePackage(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.DRIVER)
  findAll(@Query('branchId') branchId?: string, @Query('status') status?: string) {
    return this.service.findAllWarehousePackages(branchId, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.DRIVER)
  findOne(@Param('id') id: string) {
    return this.service.findWarehousePackageById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateWarehousePackageDto) {
    return this.service.updateWarehousePackage(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.service.deleteWarehousePackage(id);
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.DRIVER)
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: WarehousePackageStatus,
    @CurrentUser() user: any,
  ) {
    return this.service.updateWarehousePackageStatus(id, status, user);
  }
}
