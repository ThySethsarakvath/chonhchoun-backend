import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { RolesGuard } from '../auth/guards/role.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { Role } from '../../common/enum/role.enum';
import { UsersService } from './users.service';

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxAvatarFileSize = 5 * 1024 * 1024;

const avatarFileFilter = (
  _req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    callback(
      new BadRequestException(
        'Invalid file type. Only jpg, jpeg, png, and webp are allowed.',
      ) as unknown as Error,
      false,
    );
    return;
  }

  callback(null, true);
};

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard) // all routes in this controller require auth
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: maxAvatarFileSize,
      },
      fileFilter: avatarFileFilter,
    }),
  )
  updateMyAvatar(
    @CurrentUser() user: { _id: string },
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: Request,
  ) {
    return this.usersService.updateMyAvatar(
      user._id.toString(),
      file,
      `${request.protocol}://${request.get('host')}`,
    );
  }

  // GET /api/v1/users  ← admin only
  @Get()
  @Roles(Role.ADMIN)
  findAll() {
    return this.usersService.findAll();
  }

  // GET /api/v1/users/drivers  ← admin + agency
  @Get('drivers')
  @Roles(Role.ADMIN, Role.AGENCY)
  findDrivers() {
    return this.usersService.findByRole(Role.DRIVER);
  }

  // GET /api/v1/users/:id  ← admin only
  @Get(':id')
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  // PATCH /api/v1/users/:id/deactivate  ← admin only
  @Patch(':id/deactivate')
  @Roles(Role.ADMIN)
  deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(id);
  }
}
