import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enum/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { AgenciesService } from '../agencies/agencies.service';
import { CreateAgencyDto } from '../agencies/dto/create-agency.dto';
import { CreateBranchDto } from '../agencies/dto/create-branch.dto';
import { UpdateAgencyDto } from '../agencies/dto/update-agency.dto';
import { UpdateBranchDto } from '../agencies/dto/update-branch.dto';
import { UpgradeBranchOwnerDto } from './dto/upgrade-branch-owner.dto';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly agenciesService: AgenciesService,
    private readonly adminService: AdminService,
  ) {}

  @Get('overview')
  getOverview() {
    return this.agenciesService.getAdminOverview();
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

  @Get('agencies')
  findAgencies() {
    return this.agenciesService.findAllAgencies();
  }

  @Post('agencies')
  createAgency(@Body() dto: CreateAgencyDto) {
    return this.agenciesService.createAgency(dto);
  }

  @Get('agencies/:id')
  findAgency(@Param('id') id: string) {
    return this.agenciesService.findAgencyById(id);
  }

  @Patch('agencies/:id')
  updateAgency(@Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    return this.agenciesService.updateAgency(id, dto);
  }

  @Get('users')
  findUsers() {
    return this.adminService.findAllUsers();
  }

  @Get('activity-history')
  findActivityHistory() {
    return this.adminService.findActivityHistory();
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
