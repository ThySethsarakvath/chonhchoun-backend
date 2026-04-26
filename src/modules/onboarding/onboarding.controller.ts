import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { Role } from '../../common/enum/role.enum';

@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  // ── Public ───────────────────────────────────────────────────────────────────

  // GET /api/v1/onboarding
  // Flutter calls this on app launch — no auth required
  @Get()
  findAll() {
    return this.onboardingService.findAll();
  }

  // ── Admin only ───────────────────────────────────────────────────────────────

  // GET /api/v1/onboarding/admin
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findAllAdmin() {
    return this.onboardingService.findAllAdmin();
  }

  // GET /api/v1/onboarding/:id
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  findOne(@Param('id') id: string) {
    return this.onboardingService.findOne(id);
  }

  // POST /api/v1/onboarding
  // multipart/form-data: fields (title, subtitle, order) + file (image)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(
    FileInterceptor('image', {
      // Use memory storage — file goes directly to Cloudinary, never hits disk
      storage: undefined,
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB hard limit at multer level
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new Error('Only JPEG, PNG, and WebP files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  create(
    @Body() dto: CreateOnboardingDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.onboardingService.create(dto, file);
  }

  // PATCH /api/v1/onboarding/:id  — update text only
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOnboardingDto) {
    return this.onboardingService.update(id, dto);
  }

  // PATCH /api/v1/onboarding/:id/image  — replace image only
  @Patch(':id/image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('image'))
  updateImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.onboardingService.updateImage(id, file);
  }

  // DELETE /api/v1/onboarding/:id
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.onboardingService.remove(id);
  }

  // PATCH /api/v1/onboarding/reorder
  @Patch('reorder/order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  reorder(@Body('orderedIds') orderedIds: string[]) {
    return this.onboardingService.reorder(orderedIds);
  }
}