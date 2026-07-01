import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../common/enum/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { AgenciesService } from '../agencies/agencies.service';
import { CreateBranchDto } from '../agencies/dto/create-branch.dto';
import { UpdateBranchDto } from '../agencies/dto/update-branch.dto';
import { UpgradeBranchOwnerDto } from './dto/upgrade-branch-owner.dto';
import { AdminService } from './admin.service';
import { RevenueSharingService } from './revenue-sharing.service';
import { UpdateRevenueSharingDto } from './dto/update-revenue-sharing.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly agenciesService: AgenciesService,
    private readonly adminService: AdminService,
    private readonly revenueSharingService: RevenueSharingService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.agenciesService.getAdminOverview();
  }

  @Get('revenue-sharing/current')
  getCurrentRevenueSharing() {
    return this.revenueSharingService.getCurrentConfig();
  }

  @Get('revenue-sharing/history')
  getRevenueSharingHistory() {
    return this.revenueSharingService.listConfigs();
  }

  @Post('revenue-sharing')
  updateRevenueSharing(
    @Body() dto: UpdateRevenueSharingDto,
    @CurrentUser() user: any,
  ) {
    return this.revenueSharingService.createNewVersion(dto, user);
  }

  @Get('branches')
  findBranches() {
    return this.agenciesService.findAllBranches();
  }

  @Post('branches')
  async createBranch(@Body() dto: CreateBranchDto, @CurrentUser() user: any) {
    const branch = await this.agenciesService.createBranch(dto);
    await this.adminService.logManualBranchCreate(branch, user);
    return branch;
  }

  @Get('branches/:id')
  findBranch(@Param('id') id: string) {
    return this.agenciesService.findBranchById(id);
  }

  @Patch('branches/:id')
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.agenciesService.updateBranch(id, dto);
  }

  @Patch('branches/migrate-pending-status')
  migratePendingBranchStatus() {
    return this.adminService.migratePendingBranches();
  }

  @Get('users')
  findUsers() {
    return this.adminService.findAllUsers();
  }

  @Patch('users/:id/upgrade-branch-owner')
  upgradeBranchOwner(
    @Param('id') id: string,
    @Body() dto: UpgradeBranchOwnerDto,
    @CurrentUser() user: any,
  ) {
    return this.adminService.upgradeBranchOwner(id, dto, user);
  }

  @Patch('users/:id/downgrade-branch-owner')
  downgradeBranchOwner(@Param('id') id: string, @CurrentUser() user: any) {
    return this.adminService.downgradeBranchOwner(id, user);
  }
}
