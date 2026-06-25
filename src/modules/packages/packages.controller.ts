import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PackagesService } from './packages.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, CancelBookingDto } from './dto/update-booking.dto';
import { UpdatePackageStatusDto } from './dto/update-package-status.dto';
import { QueryBookingDto } from './dto/query-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorators';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '../../common/enum/role.enum';
import { CloudinaryService } from '../database/cloudinary/cloudinary.service';

@Controller('packages')
@UseGuards(JwtAuthGuard) // all routes require auth
export class PackagesController {
  constructor(
    private readonly packagesService: PackagesService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowed.includes(file.mimetype)) {
          return cb(new Error('Only JPEG, PNG, and WebP are allowed.'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Image file is required.');
    const { url } = await this.cloudinaryService.uploadImage(file, 'chonhchoun/packages');
    return { url };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOMER routes
  // ─────────────────────────────────────────────────────────────────────────────

  // POST /api/v1/packages
  // Create a new delivery booking request
  @Post()
  @Roles(Role.CUSTOMER, Role.ADMIN)
  @UseGuards(RolesGuard)
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: any) {
    return this.packagesService.create(dto, user);
  }

  // GET /api/v1/packages/my
  // Customer sees their own bookings (paginated + filterable)
  @Get('my')
  getMyBookings(@CurrentUser() user: any, @Query() query: QueryBookingDto) {
    return this.packagesService.findMyBookings(user._id.toString(), query);
  }



  // GET /api/v1/packages/available
  // Driver: find available packages to deliver
  @Get('available')
  @Roles(Role.DRIVER, Role.ADMIN)
  @UseGuards(RolesGuard)
  findAvailable() {
    return this.packagesService.findAvailable();
  }

  // GET /api/v1/packages/:id
  // Get single booking — customer sees own, admin sees all
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.packagesService.findOne(id, user);
  }

  // PATCH /api/v1/packages/:id
  // Update a PENDING booking (customer only, own bookings)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.packagesService.update(id, dto, user);
  }

  // PATCH /api/v1/packages/:id/cancel
  // Cancel a PENDING booking
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelBookingDto,
    @CurrentUser() user: any,
  ) {
    return this.packagesService.cancel(id, dto, user);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DRIVER routes
  // ─────────────────────────────────────────────────────────────────────────────

  // PATCH /api/v1/packages/:id/accept
  // Driver: accept delivery booking request
  @Patch(':id/accept')
  @Roles(Role.DRIVER, Role.ADMIN, Role.CUSTOMER)
  @UseGuards(RolesGuard)
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.packagesService.acceptPackage(id, user._id);
  }

  // GET /api/v1/packages/driver/my
  // Driver sees their assigned bookings
  @Get('driver/my')
  @Roles(Role.DRIVER, Role.ADMIN)
  @UseGuards(RolesGuard)
  getDriverBookings(@CurrentUser() user: any, @Query() query: QueryBookingDto) {
    return this.packagesService.findDriverBookings(user._id.toString(), query);
  }

  // PATCH /api/v1/packages/:id/status
  // Driver: update delivery status (PICKED_UP, IN_TRANSIT, DELIVERED, FAILED)
  @Patch(':id/status')
  @Roles(Role.DRIVER, Role.ADMIN, Role.CUSTOMER)
  @UseGuards(RolesGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdatePackageStatusDto,
    @CurrentUser() user: any,
  ) {
    return this.packagesService.updateStatus(id, dto.status, user, dto.podImage);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN routes
  // ─────────────────────────────────────────────────────────────────────────────

  // GET /api/v1/packages
  // Admin: list all bookings with filters and pagination
  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAll(@Query() query: QueryBookingDto) {
    return this.packagesService.findAll(query);
  }

  // DELETE /api/v1/packages/:id
  // Admin: hard delete
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.packagesService.remove(id);
  }
}
