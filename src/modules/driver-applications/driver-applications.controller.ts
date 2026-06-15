import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Role } from '../../common/enum/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { UpdateDriverVehicleTypeDto } from '../users/dto/update-driver-vehicle-type.dto';
import { AssignDriverVehicleDto } from './dto/assign-driver-vehicle.dto';
import { ApproveDriverApplicationDto } from './dto/approve-driver-application.dto';
import { CreateBranchVehicleDto } from './dto/create-branch-vehicle.dto';
import { CreateDriverApplicationDto } from './dto/create-driver-application.dto';
import { RejectDriverApplicationDto } from './dto/reject-driver-application.dto';
import { UpdateBranchVehicleDto } from './dto/update-branch-vehicle.dto';
import { UpdateDriverManagementDto } from './dto/update-driver-management.dto';
import { DriverApplicationsService } from './driver-applications.service';

@Controller('driver-applications')
export class DriverApplicationsController {
  constructor(
    private readonly driverApplicationsService: DriverApplicationsService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'avatar', maxCount: 1 },
        { name: 'cv', maxCount: 1 },
        { name: 'nationalId', maxCount: 1 },
        { name: 'drivingLicense', maxCount: 1 },
      ],
      {
        limits: { fileSize: 8 * 1024 * 1024 },
      },
    ),
  )
  create(
    @Body() dto: CreateDriverApplicationDto,
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      cv?: Express.Multer.File[];
      nationalId?: Express.Multer.File[];
      drivingLicense?: Express.Multer.File[];
    },
  ) {
    return this.driverApplicationsService.create(dto, files);
  }

  @Get('branch-owner')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  listForBranchOwner(@CurrentUser() user: any) {
    return this.driverApplicationsService.listForBranchOwner(
      user._id.toString(),
    );
  }

  @Get('branch-owner/drivers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  listDriversForBranchOwner(@CurrentUser() user: any) {
    return this.driverApplicationsService.listDriversForBranchOwner(
      user._id.toString(),
    );
  }

  @Get('branch-owner/management-overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  getManagementOverviewForBranchOwner(@CurrentUser() user: any) {
    return this.driverApplicationsService.getManagementOverviewForBranchOwner(
      user._id.toString(),
    );
  }

  @Get('branch-owner/vehicles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  listVehiclesForBranchOwner(@CurrentUser() user: any) {
    return this.driverApplicationsService.listVehiclesForBranchOwner(
      user._id.toString(),
    );
  }

  @Post('branch-owner/vehicles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  createVehicleForBranchOwner(
    @CurrentUser() user: any,
    @Body() dto: CreateBranchVehicleDto,
  ) {
    return this.driverApplicationsService.createVehicleForBranchOwner(
      user._id.toString(),
      dto,
    );
  }

  @Patch('branch-owner/vehicles/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  updateVehicleForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateBranchVehicleDto,
  ) {
    return this.driverApplicationsService.updateVehicleForBranchOwner(
      id,
      user._id.toString(),
      dto,
    );
  }

  @Patch('branch-owner/vehicles/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  deactivateVehicleForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.driverApplicationsService.deactivateVehicleForBranchOwner(
      id,
      user._id.toString(),
    );
  }

  @Patch('branch-owner/vehicles/:id/activate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  activateVehicleForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.driverApplicationsService.activateVehicleForBranchOwner(
      id,
      user._id.toString(),
    );
  }

  @Patch('branch-owner/drivers/:id/management')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  updateDriverManagementForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateDriverManagementDto,
  ) {
    return this.driverApplicationsService.updateDriverManagementForBranchOwner(
      id,
      user._id.toString(),
      dto,
    );
  }

  @Post('branch-owner/drivers/:id/assign-vehicle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  assignVehicleToDriverForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AssignDriverVehicleDto,
  ) {
    return this.driverApplicationsService.assignVehicleToDriverForBranchOwner(
      id,
      user._id.toString(),
      dto,
    );
  }

  @Patch('branch-owner/drivers/:id/unassign-vehicle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  unassignVehicleFromDriverForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.driverApplicationsService.unassignVehicleFromDriverForBranchOwner(
      id,
      user._id.toString(),
    );
  }

  @Patch('branch-owner/drivers/:id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  deactivateDriverForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.driverApplicationsService.deactivateDriverForBranchOwner(
      id,
      user._id.toString(),
    );
  }

  @Patch('branch-owner/drivers/:id/vehicle-type')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  updateDriverVehicleTypeForBranchOwner(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateDriverVehicleTypeDto,
  ) {
    return this.driverApplicationsService.updateDriverVehicleTypeForBranchOwner(
      id,
      user._id.toString(),
      dto.vehicleType,
      dto.assignedVehicleCode,
    );
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  approve(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: ApproveDriverApplicationDto,
  ) {
    return this.driverApplicationsService.approve(id, user._id.toString(), dto);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  reject(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: RejectDriverApplicationDto,
  ) {
    return this.driverApplicationsService.reject(id, user._id.toString(), dto);
  }
}
