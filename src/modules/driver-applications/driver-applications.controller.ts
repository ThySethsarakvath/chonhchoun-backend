import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
import { CreateDriverApplicationDto } from './dto/create-driver-application.dto';
import { RejectDriverApplicationDto } from './dto/reject-driver-application.dto';
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
    return this.driverApplicationsService.listForBranchOwner(user._id.toString());
  }

  @Get('branch-owner/drivers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  listDriversForBranchOwner(@CurrentUser() user: any) {
    return this.driverApplicationsService.listDriversForBranchOwner(
      user._id.toString(),
    );
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.BRANCH_OWNER)
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.driverApplicationsService.approve(id, user._id.toString());
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
