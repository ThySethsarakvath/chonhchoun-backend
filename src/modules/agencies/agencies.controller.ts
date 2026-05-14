import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { AgenciesService } from './agencies.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { CreateAgencyDto } from './dto/create-agency.dto';
import { UpdateAgencyDto } from './dto/update-agency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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

  // --- Agency Endpoints ---
  @Post('agencies')
  createAgency(@Body() dto: CreateAgencyDto) {
    return this.agenciesService.createAgency(dto);
  }

  @Get('agencies')
  getAllAgencies() {
    return this.agenciesService.findAllAgencies();
  }

  @Put('agencies/:id')
  updateAgency(@Param('id') id: string, @Body() dto: UpdateAgencyDto) {
    return this.agenciesService.updateAgency(id, dto);
  }
}