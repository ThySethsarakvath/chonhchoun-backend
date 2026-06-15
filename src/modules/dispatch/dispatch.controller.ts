import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchDto } from './dto/dispatch.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';

@Controller('dispatch')
// @UseGuards(JwtAuthGuard, RolesGuard)
// @Roles(Role.ADMIN, Role.BRANCH_OWNER)
export class DispatchController {
  constructor(private readonly svc: DispatchService) {}

  /**
   * POST /api/v1/dispatch
   * The main trigger: runs the full VRP pipeline and creates a Delivery record.
   */
  @Post()
  dispatch(@Body() dto: DispatchDto) {
    return this.svc.dispatch(dto);
  }
}