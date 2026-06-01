import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enum/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { BranchesService } from './branches.service';

@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  async getMyBranch(@CurrentUser() user: any) {
    const branch = await this.branchesService.findDetailedByOwnerId(user._id);

    if (!branch) {
      throw new NotFoundException('No branch assigned to this branch owner.');
    }

    return branch;
  }

  @Get('map')
  getMapBranches() {
    return this.branchesService.findVisibleOnMap();
  }
}
