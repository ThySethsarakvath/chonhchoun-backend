import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Controller('agencies-management')
// @UseGuards(JwtAuthGuard)
export class AgenciesController {
  constructor(private readonly agenciesService: AgenciesService) {}

  @Get('overview')
  getOverview() {
    return this.agenciesService.getAdminOverview();
  }

  // --- Branch Endpoints ---
  @Post('branches')
  createBranch(@Body() dto: CreateBranchDto) {
    return this.agenciesService.createBranch(dto);
  }

  @Get('branches')
  getAllBranches() {
    return this.agenciesService.findAllBranches();
  }

  @Put('branches/:id')
  updateBranch(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.agenciesService.updateBranch(id, dto);
  }

}
