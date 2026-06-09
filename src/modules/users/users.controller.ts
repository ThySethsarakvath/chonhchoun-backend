import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateDriverVehicleTypeDto } from './dto/update-driver-vehicle-type.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enum/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.usersService.findById(user._id.toString());
  }

  // PATCH /api/v1/users/me — update name or phone
  @Patch('me')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user._id.toString(), dto);
  }

  // POST /api/v1/users/me/avatar — upload or replace profile picture
  // multipart/form-data, field name: "avatar"
  @Post('me/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new Error('Only JPEG, PNG, and WebP are allowed.'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(user._id.toString(), file);
  }

  // DELETE /api/v1/users/me/avatar — remove profile picture
  @Delete('me/avatar')
  removeAvatar(@CurrentUser() user: any) {
    return this.usersService.removeAvatar(user._id.toString());
  }
  
  // Admin only
  // GET /api/v1/users
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // GET /api/v1/users/drivers
  @Get('drivers')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findDrivers() {
    return this.usersService.findByRole(Role.DRIVER);
  }

  // GET /api/v1/users/:id
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  // PATCH /api/v1/users/:id/deactivate
  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }

  // PATCH /api/v1/users/:id/vehicle-type
  @Patch(':id/vehicle-type')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateDriverVehicleType(
    @Param('id') id: string,
    @Body() dto: UpdateDriverVehicleTypeDto,
  ) {
    return this.usersService.updateDriverVehicleType(id, dto.vehicleType);
  }
}
